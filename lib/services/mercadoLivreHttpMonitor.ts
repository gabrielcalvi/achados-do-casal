import { supabaseAdmin } from "@/lib/supabase/admin";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

function extrairItemIdMercadoLivre(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid") || "",
      url.searchParams.get("item_id") || "",
      url.searchParams.get("pdp_filters") || "",
      url.pathname,
      link,
    ];

    for (const candidato of candidatos) {
      const match = candidato.match(/MLB[-:]?(\d{8,})/i);

      if (match?.[1]) {
        return `MLB${match[1]}`;
      }
    }
  } catch {
    const match = link.match(/MLB[-:]?(\d{8,})/i);

    if (match?.[1]) {
      return `MLB${match[1]}`;
    }
  }

  return null;
}

async function buscarProduto(produtoId: number) {
  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select("id, nome, link, preco_atual")
    .eq("id", produtoId)
    .single();

  if (error || !produto) {
    throw new Error("Produto nao encontrado.");
  }

  const link = String(produto.link || "").trim();

  if (!link) {
    throw new Error("Produto sem link original.");
  }

  return { produto, link };
}

function urlDiretaAnuncio(link: string) {
  const itemId = extrairItemIdMercadoLivre(link);

  if (!itemId) {
    return link;
  }

  return `https://produto.mercadolivre.com.br/MLB-${itemId.replace(/^MLB/i, "")}-_JM`;
}

function procurarProdutoJsonLd(valor: unknown): Record<string, any> | null {
  if (!valor) {
    return null;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = procurarProdutoJsonLd(item);
      if (encontrado) return encontrado;
    }
    return null;
  }

  if (typeof valor !== "object") {
    return null;
  }

  const objeto = valor as Record<string, any>;
  const tipo = objeto["@type"];

  if (tipo === "Product" || (Array.isArray(tipo) && tipo.includes("Product"))) {
    return objeto;
  }

  if (objeto["@graph"]) {
    return procurarProdutoJsonLd(objeto["@graph"]);
  }

  return null;
}

function extrairJsonLdProduto(html: string) {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const texto = match[1]?.trim();
    if (!texto) continue;

    try {
      const json = JSON.parse(texto);
      const produto = procurarProdutoJsonLd(json);
      if (produto) return produto;
    } catch {
      // Ignora blocos invalidos.
    }
  }

  return null;
}

function lerJson(texto: string): Record<string, any> | null {
  try {
    return JSON.parse(texto) as Record<string, any>;
  } catch {
    return null;
  }
}

export async function diagnosticarMercadoLivrePrecoOficial(produtoId: number) {
  const { produto, link } = await buscarProduto(produtoId);
  const itemId = extrairItemIdMercadoLivre(link);

  if (!itemId) {
    throw new Error("Nao foi possivel identificar o item do Mercado Livre.");
  }

  const token = await obterAccessTokenMercadoLivre();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const [respostaPrices, respostaSalePrice] = await Promise.all([
    fetch(`https://api.mercadolibre.com/items/${itemId}/prices`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(30000),
    }),
    fetch(`https://api.mercadolibre.com/items/${itemId}/sale_price`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(30000),
    }),
  ]);

  const [textoPrices, textoSalePrice] = await Promise.all([
    respostaPrices.text(),
    respostaSalePrice.text(),
  ]);

  const jsonPrices = lerJson(textoPrices);
  const jsonSalePrice = lerJson(textoSalePrice);

  const precos = Array.isArray(jsonPrices?.prices) ? jsonPrices?.prices : [];
  const precoPromocional = precos.find((preco: any) => preco?.type === "promotion");
  const precoPadrao = precos.find((preco: any) => preco?.type === "standard");
  const melhorPrecoPrices = Number(precoPromocional?.amount ?? precoPadrao?.amount ?? NaN);
  const precoSalePrice = Number(jsonSalePrice?.amount ?? NaN);

  return {
    produto_id: produto.id,
    produto: produto.nome,
    item_id_detectado: itemId,
    preco_banco: Number(produto.preco_atual),
    prices: {
      http_status: respostaPrices.status,
      ok: respostaPrices.ok,
      preco_encontrado: Number.isFinite(melhorPrecoPrices) ? melhorPrecoPrices : null,
      erro: jsonPrices?.message || jsonPrices?.error || null,
      corpo_inicio: textoPrices.slice(0, 500),
    },
    sale_price: {
      http_status: respostaSalePrice.status,
      ok: respostaSalePrice.ok,
      preco_encontrado: Number.isFinite(precoSalePrice) ? precoSalePrice : null,
      erro: jsonSalePrice?.message || jsonSalePrice?.error || null,
      corpo_inicio: textoSalePrice.slice(0, 500),
    },
  };
}

export async function diagnosticarMercadoLivreApiPublica(produtoId: number) {
  const { produto, link } = await buscarProduto(produtoId);
  const itemId = extrairItemIdMercadoLivre(link);

  if (!itemId) {
    throw new Error("Nao foi possivel identificar o item do Mercado Livre.");
  }

  const resposta = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });

  const texto = await resposta.text();
  const json = lerJson(texto);

  return {
    produto_id: produto.id,
    produto: produto.nome,
    item_id_detectado: itemId,
    preco_banco: Number(produto.preco_atual),
    http_status: resposta.status,
    ok: resposta.ok,
    nome_encontrado: json?.title || null,
    preco_encontrado: Number.isFinite(Number(json?.price)) ? Number(json?.price) : null,
    erro_api: json?.message || json?.error || null,
    corpo_inicio: texto.slice(0, 500),
  };
}

export async function diagnosticarMercadoLivreHttp(produtoId: number) {
  const { produto, link } = await buscarProduto(produtoId);
  const itemId = extrairItemIdMercadoLivre(link);
  const url = urlDiretaAnuncio(link);

  const resposta = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });

  const html = await resposta.text();
  const htmlMinusculo = html.toLowerCase();
  const verificacao =
    resposta.url.includes("/gz/account-verification") ||
    resposta.url.includes("/captcha/") ||
    htmlMinusculo.includes("verificacao de seguranca") ||
    htmlMinusculo.includes("verificação de segurança") ||
    htmlMinusculo.includes("security verification");

  const jsonLd = extrairJsonLdProduto(html);
  const oferta = Array.isArray(jsonLd?.offers)
    ? jsonLd?.offers?.[0]
    : jsonLd?.offers;

  const preco = Number(oferta?.price ?? oferta?.lowPrice ?? NaN);

  return {
    produto_id: produto.id,
    produto: produto.nome,
    item_id_detectado: itemId,
    preco_banco: Number(produto.preco_atual),
    url_usada: url,
    url_final: resposta.url,
    http_status: resposta.status,
    bytes: html.length,
    verificacao,
    encontrou_json_ld: Boolean(jsonLd),
    nome_encontrado: jsonLd?.name || null,
    preco_encontrado: Number.isFinite(preco) ? preco : null,
  };
}