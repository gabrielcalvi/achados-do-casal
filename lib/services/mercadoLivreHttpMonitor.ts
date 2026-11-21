import { supabaseAdmin } from "@/lib/supabase/admin";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

const LISTA_MERCADO_LIVRE_PRECOS = "https://meli.la/1o6hF5T";

export function extrairItemIdMercadoLivre(link: string) {
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

export type ItemListaMercadoLivre = {
  itemId: string;
  titulo: string | null;
  preco: number | null;
  precoAntigo: number | null;
  parcelas: string | null;
  imagem: string | null;
};

function moedaLista(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function consultarListaMercadoLivre() {
  const resposta = await fetch(LISTA_MERCADO_LIVRE_PRECOS, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  const html = await resposta.text();
  const htmlMinusculo = html.toLowerCase();
  const bloqueado =
    resposta.url.includes("/gz/account-verification") ||
    resposta.url.includes("/captcha/") ||
    htmlMinusculo.includes("verificacao de seguranca") ||
    htmlMinusculo.includes("verificação de segurança") ||
    htmlMinusculo.includes("security verification");

  if (!resposta.ok || bloqueado) {
    throw new Error(
      `Não foi possível ler a lista oficial do Mercado Livre com segurança (HTTP ${resposta.status}).`
    );
  }

  // A lista entrega os cards dentro de um estado JSON escapado. Normalizamos
  // apenas o necessário para ler os campos públicos do card.
  const normalizado = html
    .replace(/\\\"/g, '"')
    .replace(/\\u002F/gi, "/");

  const regexCard = /"metadata":\{"id":"(MLB\d{8,})"/g;
  const ocorrencias = Array.from(normalizado.matchAll(regexCard));

  const itensBrutos = ocorrencias.map((match, indice) => {
    const inicio = match.index ?? 0;
    const fim =
      indice + 1 < ocorrencias.length
        ? ocorrencias[indice + 1].index ?? normalizado.length
        : Math.min(normalizado.length, inicio + 18000);
    const trecho = normalizado.slice(inicio, fim);

    const titulo =
      trecho.match(/"title":\{"text":"([^"]+)"/)?.[1] ?? null;
    const precoTexto =
      trecho.match(/"current_price":\{"value":([0-9.]+)/)?.[1] ?? null;
    const preco = precoTexto ? Number(precoTexto) : null;
    const precoAntigoTexto =
      trecho.match(/"previous_price":\{"value":([0-9.]+)/)?.[1] ?? null;
    const precoAntigo = precoAntigoTexto ? Number(precoAntigoTexto) : null;

    const pictureId =
      trecho.match(/"pictures":\{"scale":"[^"]+","pictures":\[\{"id":"([^"]+)"/)?.[1] ??
      trecho.match(/"pictures":\[\{"id":"([^"]+)"/)?.[1] ??
      null;
    const imagem = pictureId
      ? `https://http2.mlstatic.com/D_Q_NP_2X_${pictureId}-AB.webp`
      : null;

    const parcelasTexto =
      trecho.match(/"installments":\{"text":"([^"]+)"/)?.[1] ?? null;
    const valorParcelaTexto =
      trecho.match(
        /"installments":\{"text":"[^"]+"[\s\S]{0,1200}?"price":\{"value":([0-9.]+)/
      )?.[1] ?? null;
    const valorParcela = valorParcelaTexto ? Number(valorParcelaTexto) : null;

    let parcelas = parcelasTexto;
    if (parcelas && parcelas.includes("{price}") && Number.isFinite(valorParcela)) {
      parcelas = parcelas.replace("{price}", moedaLista(valorParcela as number));
    }

    return {
      itemId: match[1].toUpperCase(),
      titulo,
      preco: Number.isFinite(preco) ? preco : null,
      precoAntigo: Number.isFinite(precoAntigo) ? precoAntigo : null,
      parcelas,
      imagem,
    } satisfies ItemListaMercadoLivre;
  });

  const porId = new Map<string, ItemListaMercadoLivre>();
  for (const item of itensBrutos) {
    if (!porId.has(item.itemId)) {
      porId.set(item.itemId, item);
    }
  }

  const itens = Array.from(porId.values());

  if (!itens.length) {
    throw new Error(
      "A lista do Mercado Livre abriu, mas nenhum card de produto foi identificado."
    );
  }

  return {
    url: LISTA_MERCADO_LIVRE_PRECOS,
    urlFinal: resposta.url,
    totalItensIdentificados: itens.length,
    itemIds: new Set(itens.map((item) => item.itemId)),
    itens,
  };
}

async function buscarItensListaMercadoLivre() {
  return consultarListaMercadoLivre();
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

export async function atualizarMercadoLivreManuaisViaHttp() {
  const lista = await buscarItensListaMercadoLivre();

  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,loja,link,preco_atual,preco_antigo,monitoramento_manual,ativo")
    .eq("ativo", true)
    .eq("monitoramento_manual", true)
    .ilike("loja", "%Mercado Livre%")
    .order("id");

  if (error) {
    throw new Error(`Erro ao carregar produtos ML manuais: ${error.message}`);
  }

  const resultados: Array<Record<string, unknown>> = [];
  let atualizados = 0;
  let erros = 0;
  let foraDaLista = 0;
  let elegiveis = 0;

  for (const produto of produtos || []) {
    const itemId = extrairItemIdMercadoLivre(String(produto.link || ""));

    if (!itemId || !lista.itemIds.has(itemId)) {
      foraDaLista += 1;
      resultados.push({
        id: produto.id,
        nome: produto.nome,
        sucesso: false,
        ignorado: true,
        itemId,
        erro: "Produto não consta na lista oficial do Mercado Livre usada para atualização de preços.",
      });
      continue;
    }

    elegiveis += 1;

    try {
      const diagnostico = await diagnosticarMercadoLivreHttp(Number(produto.id));
      const precoNovo = Number(diagnostico.preco_encontrado);
      const precoBanco = Number(produto.preco_atual);

      if (
        diagnostico.verificacao ||
        !diagnostico.encontrou_json_ld ||
        !Number.isFinite(precoNovo) ||
        precoNovo <= 0
      ) {
        throw new Error("Preço visual confiável não confirmado.");
      }

      if (precoBanco > 0) {
        const proporcao = precoNovo / precoBanco;
        if (proporcao < 0.05 || proporcao > 20) {
          throw new Error(`Preço suspeito bloqueado: R$ ${precoNovo.toFixed(2)}`);
        }
      }

      const mudou = Math.abs(precoNovo - precoBanco) >= 0.01;
      const agora = new Date().toISOString();

      if (mudou) {
        const { error: erroUpdate } = await supabaseAdmin
          .from("produtos")
          .update({
            preco_antigo: precoBanco > 0 ? precoBanco : produto.preco_antigo,
            preco_atual: precoNovo,
            preco_monitorado: precoNovo,
            preco_manual_atualizado_em: agora,
            ultima_verificacao: agora,
            updated_at: agora,
            monitor_erro: null,
            monitor_erro_em: null,
            monitor_falhas_consecutivas: 0,
          })
          .eq("id", produto.id);

        if (erroUpdate) throw erroUpdate;

        await supabaseAdmin.from("monitor_alteracoes").insert({
          produto_id: produto.id,
          tipo: "preco",
          valor_antigo: String(precoBanco),
          valor_novo: String(precoNovo),
          status: "aprovado",
          observacao:
            "Atualização manual em lote validada pela lista oficial do Mercado Livre e pelo JSON-LD do anúncio.",
          atualizado_em: agora,
          aprovado_em: agora,
        });

        atualizados += 1;
      } else {
        await supabaseAdmin
          .from("produtos")
          .update({
            ultima_verificacao: agora,
            preco_manual_atualizado_em: agora,
            monitor_erro: null,
            monitor_erro_em: null,
            monitor_falhas_consecutivas: 0,
          })
          .eq("id", produto.id);
      }

      resultados.push({
        id: produto.id,
        nome: produto.nome,
        sucesso: true,
        itemId,
        precoBanco,
        precoNovo,
        mudou,
        urlFinal: diagnostico.url_final,
      });
    } catch (erroProduto) {
      erros += 1;
      resultados.push({
        id: produto.id,
        nome: produto.nome,
        sucesso: false,
        itemId,
        erro: erroProduto instanceof Error ? erroProduto.message : String(erroProduto),
      });
    }
  }

  return {
    lista: LISTA_MERCADO_LIVRE_PRECOS,
    listaUrlFinal: lista.urlFinal,
    itensNaListaIdentificados: lista.totalItensIdentificados,
    totalProdutosMlManuais: (produtos || []).length,
    elegiveis,
    foraDaLista,
    atualizados,
    erros,
    resultados,
  };
}
