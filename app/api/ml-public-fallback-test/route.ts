import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizarId(valor: string | null | undefined) {
  const texto = String(valor || "").toUpperCase().replace(/-/g, "");
  const match = texto.match(/MLB\d{8,}/);
  return match?.[0] || null;
}

function extrairItemId(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid"),
      url.searchParams.get("item_id"),
      url.searchParams.get("pdp_filters"),
      decodeURIComponent(url.hash || ""),
      decodeURIComponent(link),
    ];
    for (const candidato of candidatos) {
      const id = normalizarId(candidato);
      if (id) return id;
    }
  } catch {
    return normalizarId(link);
  }
  return null;
}

function extrairProductId(link: string) {
  try {
    const url = new URL(link);
    const m = url.pathname.match(/\/p\/(MLB\d{8,})/i);
    return normalizarId(m?.[1]);
  } catch {
    const m = link.match(/\/p\/(MLB\d{8,})/i);
    return normalizarId(m?.[1]);
  }
}

async function fetchTexto(url: string, headers?: Record<string,string>) {
  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: headers || { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    return {
      status: resposta.status,
      ok: resposta.ok,
      urlFinal: resposta.url,
      texto: await resposta.text(),
    };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      urlFinal: url,
      texto: e instanceof Error ? e.message : String(e),
    };
  }
}

function tentarJson(texto: string) {
  try { return JSON.parse(texto); } catch { return null; }
}

function extrairJsonLdPreco(html: string) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const j = JSON.parse(m[1]);
      const fila:any[] = Array.isArray(j) ? [...j] : [j];
      while (fila.length) {
        const x:any = fila.shift();
        if (!x || typeof x !== "object") continue;
        if (Array.isArray(x)) { fila.push(...x); continue; }
        if (x["@graph"]) fila.push(x["@graph"]);
        const tipo = x["@type"];
        if (tipo === "Product" || (Array.isArray(tipo) && tipo.includes("Product"))) {
          const offers = Array.isArray(x.offers) ? x.offers[0] : x.offers;
          const preco = Number(offers?.price ?? offers?.lowPrice ?? NaN);
          return {
            nome: x.name || null,
            preco: Number.isFinite(preco) ? preco : null,
            moeda: offers?.priceCurrency || null,
          };
        }
      }
    } catch {}
  }
  return null;
}

export async function GET() {
  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,link,preco_atual")
    .eq("loja", "Mercado Livre")
    .eq("ativo", true)
    .order("id");

  if (error) return Response.json({ sucesso:false, erro:error.message }, { status:500 });

  const resultados:any[] = [];

  for (const produto of produtos || []) {
    const link = String(produto.link || "");
    const itemId = extrairItemId(link);
    const productId = extrairProductId(link);

    const resultado:any = {
      produto_id: produto.id,
      nome: produto.nome,
      preco_banco: Number(produto.preco_atual),
      item_id: itemId,
      product_id: productId,
      testes: {},
    };

    if (itemId) {
      const itemPublico = await fetchTexto(
        `https://api.mercadolibre.com/items/${itemId}?attributes=id,title,price,original_price,permalink,thumbnail,status`
      );
      const itemJson:any = tentarJson(itemPublico.texto);
      resultado.testes.items_publico = {
        status: itemPublico.status,
        price: Number.isFinite(Number(itemJson?.price)) ? Number(itemJson.price) : null,
        original_price: Number.isFinite(Number(itemJson?.original_price)) ? Number(itemJson.original_price) : null,
        erro: itemPublico.ok ? null : itemJson?.message || itemJson?.error || itemPublico.texto.slice(0,180),
      };

      const bulk = await fetchTexto(
        `https://api.mercadolibre.com/items?ids=${itemId}&attributes=id,title,price,original_price,permalink,status`
      );
      const bulkJson:any = tentarJson(bulk.texto);
      const body = Array.isArray(bulkJson) ? bulkJson[0]?.body : null;
      resultado.testes.items_bulk_publico = {
        status: bulk.status,
        body_status: Array.isArray(bulkJson) ? bulkJson[0]?.code || bulkJson[0]?.status_code || null : null,
        price: Number.isFinite(Number(body?.price)) ? Number(body.price) : null,
        original_price: Number.isFinite(Number(body?.original_price)) ? Number(body.original_price) : null,
        erro: bulk.ok ? null : bulk.texto.slice(0,180),
      };

      const paginaDireta = await fetchTexto(
        `https://produto.mercadolivre.com.br/MLB-${itemId.replace(/^MLB/,"")}-_JM`,
        {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
          "accept-language": "pt-BR,pt;q=0.9",
          accept: "text/html,application/xhtml+xml",
        }
      );
      const verificacao = /captcha|security verification|verifica[cç][aã]o de seguran[cç]a|account-verification/i.test(paginaDireta.texto) || /\/gz\/account-verification/.test(paginaDireta.urlFinal);
      resultado.testes.pagina_direta_jsonld = {
        status: paginaDireta.status,
        url_final: paginaDireta.urlFinal,
        verificacao,
        jsonld: verificacao ? null : extrairJsonLdPreco(paginaDireta.texto),
        bytes: paginaDireta.texto.length,
      };
    }

    if (productId) {
      const catalogo = await fetchTexto(
        `https://api.mercadolibre.com/products/${productId}`
      );
      const catJson:any = tentarJson(catalogo.texto);
      resultado.testes.catalogo_publico = {
        status: catalogo.status,
        buy_box_item_id: catJson?.buy_box_winner?.item_id || null,
        buy_box_price: Number.isFinite(Number(catJson?.buy_box_winner?.price))
          ? Number(catJson.buy_box_winner.price)
          : null,
        erro: catalogo.ok ? null : catJson?.message || catJson?.error || catalogo.texto.slice(0,180),
      };
    }

    resultados.push(resultado);
  }

  return Response.json({
    sucesso:true,
    modo:"somente_leitura",
    aviso:"Sem alteração de banco e sem bypass de captcha/controle de acesso.",
    quantidade: resultados.length,
    resultados,
  });
}
