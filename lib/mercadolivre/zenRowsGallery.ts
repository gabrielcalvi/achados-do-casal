import { load } from "cheerio";

type JsonObject = Record<string, unknown>;

function limparUrl(valor: unknown): string {
  let url = String(valor || "").trim();
  if (!url) return "";

  url = url
    .replace(/&amp;/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();

  if (url.startsWith("//")) url = `https:${url}`;
  if (!/^https?:\/\//i.test(url)) return "";

  try {
    const parsed = new URL(url);
    if (!/(^|\.)mlstatic\.com$/i.test(parsed.hostname)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function urlsDoSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((parte) => parte.trim().split(/\s+/)[0] || "")
    .map(limparUrl)
    .filter(Boolean);
}

function localizarProdutoJsonLd(valor: unknown): JsonObject | null {
  if (!valor) return null;

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = localizarProdutoJsonLd(item);
      if (encontrado) return encontrado;
    }
    return null;
  }

  if (typeof valor !== "object") return null;
  const objeto = valor as JsonObject;
  const tipo = objeto["@type"];

  if (tipo === "Product" || (Array.isArray(tipo) && tipo.includes("Product"))) {
    return objeto;
  }

  if (objeto["@graph"]) {
    const encontrado = localizarProdutoJsonLd(objeto["@graph"]);
    if (encontrado) return encontrado;
  }

  return null;
}

function imagensDoJsonLd(produto: JsonObject | null): string[] {
  const bruto = produto?.image;
  const itens = Array.isArray(bruto) ? bruto : bruto ? [bruto] : [];

  return itens
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const objeto = item as JsonObject;
        return [objeto.url, objeto.contentUrl];
      }
      return [];
    })
    .map(limparUrl)
    .filter(Boolean);
}

function extrairGaleriaDoHtml(html: string): string[] {
  const $ = load(html);
  const urls: string[] = [];

  urls.push(
    limparUrl($('meta[property="og:image"]').attr("content")),
    limparUrl($('meta[name="twitter:image"]').attr("content"))
  );

  $('script[type="application/ld+json"]').each((_, elemento) => {
    const texto = $(elemento).text();
    if (!texto) return;
    try {
      urls.push(...imagensDoJsonLd(localizarProdutoJsonLd(JSON.parse(texto))));
    } catch {
      // Ignora JSON-LD invalido.
    }
  });

  $("img").each((_, elemento) => {
    const atributos = [
      $(elemento).attr("data-zoom"),
      $(elemento).attr("data-src"),
      $(elemento).attr("src"),
      $(elemento).attr("data-lazy"),
      $(elemento).attr("data-original"),
    ];

    for (const valor of atributos) {
      const url = limparUrl(valor);
      if (url) urls.push(url);
    }

    const srcset = $(elemento).attr("srcset") || $(elemento).attr("data-srcset") || "";
    if (srcset) urls.push(...urlsDoSrcset(srcset));
  });

  const htmlNormalizado = html
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");

  const regex = /https?:\/\/[^"'<>\s]+?mlstatic\.com\/[^"'<>\s\\]+/gi;
  for (const match of htmlNormalizado.match(regex) || []) {
    const url = limparUrl(match);
    if (url) urls.push(url);
  }

  const unicas = Array.from(new Set(urls.filter(Boolean)));

  return unicas.sort((a, b) => {
    const pontuar = (url: string) => {
      let pontos = 0;
      if (/D_NQ_NP_/i.test(url)) pontos += 10;
      if (/-F\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(url)) pontos += 5;
      if (/D_NQ_NP_\d+-ML[AB]/i.test(url)) pontos += 3;
      if (/thumb|logo|avatar|sprite/i.test(url)) pontos -= 10;
      return pontos;
    };
    return pontuar(b) - pontuar(a);
  });
}

export function zenRowsGaleriaConfigurada(): boolean {
  return Boolean(process.env.ZENROWS_API_KEY?.trim());
}

export async function buscarGaleriaMercadoLivreZenRows(link: string): Promise<string[]> {
  const apiKey = process.env.ZENROWS_API_KEY?.trim();
  if (!apiKey) return [];

  const parametros = new URLSearchParams({
    url: link,
    apikey: apiKey,
    js_render: "true",
    premium_proxy: "true",
    proxy_country: "br",
  });

  const resposta = await fetch(`https://api.zenrows.com/v1/?${parametros.toString()}`, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    },
    signal: AbortSignal.timeout(90000),
  });

  const html = await resposta.text();

  if (!resposta.ok) {
    throw new Error(`ZenRows respondeu ${resposta.status}: ${html.slice(0, 500)}`);
  }

  if (
    /\/gz\/account-verification|\/captcha\//i.test(html) ||
    /para continuar, acesse sua conta|voce alcancou o limite de tentativas/i.test(html)
  ) {
    throw new Error("ZenRows ainda recebeu a verificacao de seguranca do Mercado Livre.");
  }

  return extrairGaleriaDoHtml(html);
}
