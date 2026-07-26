const {
  limparTexto,
  normalizarPreco,
  extrairJsonLd,
  obterTexto,
  obterAtributo,
} = require("./helpers.cjs");

async function extrairValorMonetario(page, seletorBase) {
  const inteiro = await obterTexto(
    page,
    `${seletorBase} .andes-money-amount__fraction`
  );

  const centavos = await obterTexto(
    page,
    `${seletorBase} .andes-money-amount__cents`
  );

  if (!inteiro) {
    return "";
  }

  return normalizarPreco(
    centavos ? `${inteiro},${centavos}` : inteiro
  );
}

async function extrairMercadoLivre(page, urlProduto) {
  console.log("[WORKER] Extraindo Mercado Livre:", urlProduto);

  await page.bringToFront();

  await page.goto(urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  console.log("[WORKER] page.goto() concluído");

  await page
    .locator(
      'h1.ui-pdp-title, script[type="application/ld+json"]'
    )
    .first()
    .waitFor({
      state: "attached",
      timeout: 15000,
    })
    .catch(() => undefined);

  if (
    page.url().includes("/gz/account-verification") ||
    page.url().includes("/captcha/")
  ) {
    throw new Error(
      "O Mercado Livre solicitou uma nova verificação de segurança."
    );
  }

  const jsonLd = await extrairJsonLd(page);

  console.log("[WORKER] JSON-LD carregado");

  const oferta = Array.isArray(jsonLd?.offers)
    ? jsonLd.offers[0]
    : jsonLd?.offers || null;

  const nome =
    limparTexto(jsonLd?.name) ||
    (await obterTexto(page, "h1.ui-pdp-title")) ||
    limparTexto(
      await obterAtributo(
        page,
        'meta[property="og:title"]',
        "content"
      )
    );

  const precoAtual =
    normalizarPreco(oferta?.price) ||
    normalizarPreco(oferta?.lowPrice) ||
    (await extrairValorMonetario(
      page,
      ".ui-pdp-price__second-line"
    ));

  let precoAntigo =
    normalizarPreco(oferta?.highPrice) ||
    (await extrairValorMonetario(
      page,
      ".ui-pdp-price__original-value"
    ));

  if (
    precoAntigo &&
    precoAtual &&
    Number(precoAntigo) <= Number(precoAtual)
  ) {
    precoAntigo = "";
  }

  const imagemJsonLd = Array.isArray(jsonLd?.image)
    ? jsonLd.image[0]
    : jsonLd?.image;

  const imagem =
    limparTexto(imagemJsonLd) ||
    limparTexto(
      await obterAtributo(
        page,
        'meta[property="og:image"]',
        "content"
      )
    ) ||
    limparTexto(
      await obterAtributo(
        page,
        ".ui-pdp-gallery__figure img",
        "src"
      )
    ) ||
    limparTexto(
      await obterAtributo(
        page,
        ".ui-pdp-gallery__figure img",
        "data-zoom"
      )
    );

  const urlsGaleria = [
    ...(Array.isArray(jsonLd?.image)
      ? jsonLd.image
      : jsonLd?.image
        ? [jsonLd.image]
        : []),

    ...(await page
      .locator(".ui-pdp-gallery__figure img")
      .evaluateAll((imagens) =>
        imagens.flatMap((item) => [
          item.getAttribute("data-zoom"),
          item.getAttribute("src"),
        ])
      )
      .catch(() => [])),
  ]
    .map((url) => limparTexto(url))
    .filter((url) => url && url.startsWith("http"));

  const imagensUnicas = new Map();

  for (const url of urlsGaleria) {
    const identificador =
      url.match(/ML[A-Z]\d+_\d+/i)?.[0] || url;

    if (!imagensUnicas.has(identificador)) {
      imagensUnicas.set(identificador, url);
    }
  }

  const imagensGaleria = Array.from(
    imagensUnicas.values()
  );

  const avaliacaoTexto =
    limparTexto(
      await page
        .locator(".ui-pdp-review__rating")
        .first()
        .textContent()
        .catch(() => "")
    ) || "";

  const avaliacao =
    Number(avaliacaoTexto.replace(",", ".")) || null;

  const breadcrumbs = await page
    .locator(".andes-breadcrumb__link")
    .allTextContents()
    .catch(() => []);

  const categoria =
    limparTexto(jsonLd?.category) ||
    limparTexto(breadcrumbs.join(" > "));

  const parcelasBrutas =
    limparTexto(
      await page
        .locator("text=/\\d+x\\s*R\\$/i")
        .first()
        .innerText()
        .catch(() => "")
    ) || "";

  const parcelas =
    parcelasBrutas
      .replace(/\s*([.,])\s*/g, "$1")
      .match(
        /\b\d+x\s+R\$\s*\d+(?:[.,]\d{2})?(?:\s+sem juros)?/i
      )?.[0] || "";

  const freteGratis =
    (await page
      .locator("text=/Frete grátis/i")
      .count()) > 0;

  const vendas =
    limparTexto(
      await page
        .locator(".ui-pdp-subtitle")
        .first()
        .textContent()
        .catch(() => "")
    )
      .split("|")
      .find((parte) => /vendidos?/i.test(parte))
      ?.trim() || "";

  if (!nome) {
    throw new Error(
      `Nome do produto não encontrado. URL final: ${page.url()}`
    );
  }

  if (!precoAtual) {
    throw new Error(
      `Preço do produto não encontrado. URL final: ${page.url()}`
    );
  }

  const dados = {
    nome,
    categoria,
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas,
    freteGratis,
    imagem,
    imagensGaleria,
    avaliacao,
    vendas,
    urlFinal: page.url(),
  };

  console.log("[WORKER] Produto Mercado Livre extraído:", dados);

  return dados;
}

module.exports = {
  extrairMercadoLivre,
};