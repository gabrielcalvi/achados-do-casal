import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function diagnosticarMercadoLivreHttp(produtoId: number) {
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