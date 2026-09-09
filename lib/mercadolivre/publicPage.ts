import { load } from "cheerio";

type JsonObject = Record<string, unknown>;

function limparTexto(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarPreco(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  let texto = String(valor)
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!texto) return "";

  if (texto.includes(".") && texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : "";
}

function precoDosSeletores($: ReturnType<typeof load>, seletorBase: string) {
  const inteiro = limparTexto(
    $(`${seletorBase} .andes-money-amount__fraction`).first().text()
  );
  const centavos = limparTexto(
    $(`${seletorBase} .andes-money-amount__cents`).first().text()
  );

  if (!inteiro) return "";

  const parteInteira = inteiro.replace(/\D/g, "");
  const parteCentavos = centavos.replace(/\D/g, "").slice(0, 2);

  return parteCentavos
    ? `${parteInteira}.${parteCentavos.padEnd(2, "0")}`
    : parteInteira;
}

function ehProdutoJsonLd(valor: unknown): valor is JsonObject {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const tipo = (valor as JsonObject)["@type"];
  return tipo === "Product" ||
    (Array.isArray(tipo) && tipo.includes("Product"));
}

function localizarProdutoJsonLd(valor: unknown): JsonObject | null {
  if (ehProdutoJsonLd(valor)) return valor;

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = localizarProdutoJsonLd(item);
      if (achado) return achado;
    }
    return null;
  }

  if (valor && typeof valor === "object") {
    const objeto = valor as JsonObject;

    if (objeto["@graph"]) {
      const achado = localizarProdutoJsonLd(objeto["@graph"]);
      if (achado) return achado;
    }

    for (const item of Object.values(objeto)) {
      const achado = localizarProdutoJsonLd(item);
      if (achado) return achado;
    }
  }

  return null;
}

function lerProdutoJsonLd($: ReturnType<typeof load>): JsonObject | null {
  let produto: JsonObject | null = null;

  $('script[type="application/ld+json"]').each((_, elemento) => {
    if (produto) return;

    const texto = $(elemento).text();
    if (!texto) return;

    try {
      produto = localizarProdutoJsonLd(JSON.parse(texto));
    } catch {
      // Ignora JSON-LD invalido.
    }
  });

  return produto;
}

function lerImagensJsonLd(produto: JsonObject | null): string[] {
  const imagem = produto?.image;
  const valores = Array.isArray(imagem) ? imagem : imagem ? [imagem] : [];

  return valores
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const objeto = item as JsonObject;
        return limparTexto(objeto.url || objeto.contentUrl);
      }
      return "";
    })
    .filter((url) => /^https?:\/\//i.test(url));
}

export async function extrairMercadoLivrePaginaPublica(link: string) {
  const resposta = await fetch(link, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  const html = await resposta.text();
  const urlFinal = resposta.url || link;

  if (!resposta.ok) {
    throw new Error(`Pagina publica do Mercado Livre respondeu ${resposta.status}.`);
  }

  if (
    /\/gz\/account-verification|\/captcha\//i.test(urlFinal) ||
    /para continuar, acesse sua conta|voce alcancou o limite de tentativas/i.test(html)
  ) {
    throw new Error("Pagina publica do Mercado Livre pediu verificacao de seguranca.");
  }

  const $ = load(html);
  const jsonLd = lerProdutoJsonLd($);
  const ofertasBrutas = jsonLd?.offers;
  const oferta = Array.isArray(ofertasBrutas)
    ? (ofertasBrutas[0] as JsonObject | undefined)
    : ofertasBrutas && typeof ofertasBrutas === "object"
      ? (ofertasBrutas as JsonObject)
      : undefined;

  const nome =
    limparTexto(jsonLd?.name) ||
    limparTexto($("h1.ui-pdp-title").first().text()) ||
    limparTexto($('meta[property="og:title"]').attr("content"));

  const precoAtual =
    normalizarPreco(oferta?.price) ||
    normalizarPreco(oferta?.lowPrice) ||
    normalizarPreco($('meta[property="product:price:amount"]').attr("content")) ||
    precoDosSeletores($, ".ui-pdp-price__second-line");

  let precoAntigo =
    normalizarPreco(oferta?.highPrice) ||
    precoDosSeletores($, ".ui-pdp-price__original-value");

  if (
    precoAntigo &&
    precoAtual &&
    Number(precoAntigo) <= Number(precoAtual)
  ) {
    precoAntigo = "";
  }

  const imagens = [
    ...lerImagensJsonLd(jsonLd),
    limparTexto($('meta[property="og:image"]').attr("content")),
    ...$(".ui-pdp-gallery__figure img")
      .toArray()
      .flatMap((elemento) => [
        limparTexto($(elemento).attr("data-zoom")),
        limparTexto($(elemento).attr("src")),
      ]),
  ].filter((url) => /^https?:\/\//i.test(url));

  const imagensGaleria = Array.from(new Set(imagens));

  const categoria =
    limparTexto(jsonLd?.category) ||
    $(".andes-breadcrumb__link")
      .toArray()
      .map((elemento) => limparTexto($(elemento).text()))
      .filter(Boolean)
      .join(" > ");

  const avaliacaoTexto = limparTexto($(".ui-pdp-review__rating").first().text());
  const avaliacaoNumero = Number(avaliacaoTexto.replace(",", "."));
  const avaliacao = Number.isFinite(avaliacaoNumero) && avaliacaoNumero > 0
    ? avaliacaoNumero
    : null;

  const subtitulo = limparTexto($(".ui-pdp-subtitle").first().text());
  const vendas =
    subtitulo
      .split("|")
      .map((parte) => parte.trim())
      .find((parte) => /vendidos?/i.test(parte)) || "";

  const textoPagina = limparTexto($("body").text());
  const parcelas =
    textoPagina.match(
      /\b\d+x\s+R\$\s*\d+(?:[.,]\d{2})?(?:\s+sem juros)?/i
    )?.[0] || "";

  const freteGratis = /frete gratis|frete grátis/i.test(textoPagina);

  if (!nome) {
    throw new Error("Nome do produto nao encontrado na pagina publica do Mercado Livre.");
  }

  if (!precoAtual) {
    throw new Error("Preco do produto nao encontrado na pagina publica do Mercado Livre.");
  }

  return {
    nome,
    categoria,
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas,
    freteGratis,
    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    avaliacao,
    vendas,
    urlFinal,
  };
}
