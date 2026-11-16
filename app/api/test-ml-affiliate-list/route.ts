export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchTexto(url: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      "accept-language": "pt-BR,pt;q=0.9",
      accept: "text/html,application/xhtml+xml",
      ...(init.headers || {}),
    },
  });
  return {
    status: r.status,
    ok: r.ok,
    urlFinal: r.url,
    texto: await r.text(),
  };
}

function extrairPrecos(html: string) {
  const resultados: Array<{nome:string|null;preco:number|null;moeda:string|null}> = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const m of html.matchAll(re)) {
    try {
      const json = JSON.parse(m[1]);
      const fila:any[] = Array.isArray(json) ? [...json] : [json];
      while (fila.length) {
        const x:any = fila.shift();
        if (!x || typeof x !== "object") continue;
        if (Array.isArray(x)) {
          fila.push(...x);
          continue;
        }
        if (x["@graph"]) fila.push(x["@graph"]);
        const tipo = x["@type"];
        if (tipo === "Product" || (Array.isArray(tipo) && tipo.includes("Product"))) {
          const offers = Array.isArray(x.offers) ? x.offers[0] : x.offers;
          const p = Number(offers?.price ?? offers?.lowPrice ?? NaN);
          resultados.push({
            nome: x.name || null,
            preco: Number.isFinite(p) ? p : null,
            moeda: offers?.priceCurrency || null,
          });
        }
      }
    } catch {}
  }
  return resultados;
}

function extrairTextosPreco(html: string) {
  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

  const precos = [...texto.matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g)].map((m) => m[0]);
  return {
    amostra: texto.slice(0, 5000),
    precos: [...new Set(precos)].slice(0, 100),
  };
}

export async function GET() {
  const origem = "https://meli.la/1o6hF5T";
  try {
    const r = await fetchTexto(origem);
    const dados = extrairTextosPreco(r.texto);
    return Response.json({
      sucesso: true,
      origem,
      status: r.status,
      url_final: r.urlFinal,
      bytes: r.texto.length,
      jsonld: extrairPrecos(r.texto),
      item_ids: [...new Set((r.texto.match(/MLB-?\\d{8,}/gi) || []).map((id) => id.toUpperCase().replace(/-/g, "")))].slice(0, 200),
      precos_texto: dados.precos,
      amostra_texto: dados.amostra,
      bloqueio: /captcha|account-verification|verifica[cç][aã]o de seguran[cç]a/i.test(r.texto) || /account-verification/.test(r.urlFinal),
    });
  } catch (e) {
    return Response.json(
      { sucesso:false, erro:e instanceof Error ? e.message : String(e) },
      { status:500 }
    );
  }
}
