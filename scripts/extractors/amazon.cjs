const {
  limparTexto,
  normalizarPreco,
  extrairJsonLd,
  obterTexto,
  obterAtributo,
} = require("./helpers.cjs");

async function extrairAmazon(page, urlProduto) {
  console.log("[WORKER] Extraindo Amazon:", urlProduto);

  await page.bringToFront();

  await page.goto(urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page
    .locator(
      [
        "#productTitle",
        "#title",
        'script[type="application/ld+json"]',
      ].join(", ")
    )
    .first()
    .waitFor({
      state: "attached",
      timeout: 20000,
    })
    .catch(() => undefined);

  const urlFinal = page.url();

  if (
    urlFinal.includes("/errors/validateCaptcha") ||
    urlFinal.includes("/ap/signin")
  ) {
    throw new Error(
      "A Amazon solicitou uma verificação de segurança."
    );
  }

  const jsonLd = await extrairJsonLd(page);

  const oferta = Array.isArray(jsonLd?.offers)
    ? jsonLd.offers[0]
    : jsonLd?.offers || null;

  const nome =
    limparTexto(jsonLd?.name) ||
    (await obterTexto(page, "#productTitle")) ||
    (await obterTexto(page, "#title")) ||
    limparTexto(
      await obterAtributo(
        page,
        'meta[property="og:title"]',
        "content"
      )
    );

  const precoTexto =
    (await obterTexto(
      page,
      "#corePrice_feature_div .a-offscreen"
    )) ||
    (await obterTexto(
      page,
      "#corePriceDisplay_desktop_feature_div .a-offscreen"
    )) ||
    (await obterTexto(
      page,
      ".priceToPay .a-offscreen"
    )) ||
    (await obterTexto(page, "#priceblock_ourprice")) ||
    (await obterTexto(page, "#priceblock_dealprice")) ||
    (await obterTexto(page, "#price_inside_buybox"));

  const precoAtual =
    normalizarPreco(oferta?.price) ||
    normalizarPreco(oferta?.lowPrice) ||
    normalizarPreco(precoTexto);

  let precoAntigo =
    normalizarPreco(oferta?.highPrice) ||
    normalizarPreco(
      await obterTexto(
        page,
        [
          ".basisPrice .a-offscreen",
          ".a-price.a-text-price .a-offscreen",
          "#listPrice",
        ].join(", ")
      )
    );

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
        "#landingImage",
        "data-old-hires"
      )
    ) ||
    limparTexto(
      await obterAtributo(
        page,
        "#landingImage",
        "src"
      )
    ) ||
    limparTexto(
      await obterAtributo(
        page,
        'meta[property="og:image"]',
        "content"
      )
    );

  const imagensAmazon = await page
    .locator(
      [
        "#altImages img",
        ".imageThumbnail img",
        "#landingImage",
      ].join(", ")
    )
    .evaluateAll((imagens) =>
      imagens.flatMap((item) => [
        item.getAttribute("data-old-hires"),
        item.getAttribute("data-a-dynamic-image"),
        item.getAttribute("src"),
      ])
    )
    .catch(() => []);

  const urlsGaleria = [
    ...(Array.isArray(jsonLd?.image)
      ? jsonLd.image
      : jsonLd?.image
        ? [jsonLd.image]
        : []),
    ...imagensAmazon,
    imagem,
  ]
    .flatMap((valor) => {
      if (!valor) {
        return [];
      }

      const texto = String(valor).trim();

      if (texto.startsWith("{")) {
        try {
          return Object.keys(JSON.parse(texto));
        } catch {
          return [];
        }
      }

      return [texto];
    })
    .map((url) => limparTexto(url))
    .filter((url) => url.startsWith("http"));

  const imagensGaleria = Array.from(
    new Set(
      urlsGaleria.map((url) =>
        url.replace(/\._[^.]+_\./, ".")
      )
    )
  );

  const avaliacaoTexto =
    (await obterTexto(
      page,
      [
        "#acrPopover .a-icon-alt",
        "[data-hook='rating-out-of-text']",
        "#averageCustomerReviews .a-icon-alt",
      ].join(", ")
    )) || "";

  const avaliacaoCorrespondencia =
    avaliacaoTexto.match(/(\d+(?:[.,]\d+)?)/);

  const avaliacao = avaliacaoCorrespondencia
    ? Number(
        avaliacaoCorrespondencia[1].replace(",", ".")
      )
    : null;

  const breadcrumbs = await page
    .locator(
      [
        "#wayfinding-breadcrumbs_feature_div a",
        "#wayfinding-breadcrumbs_container a",
      ].join(", ")
    )
    .allTextContents()
    .catch(() => []);

  const categoria =
    limparTexto(jsonLd?.category) ||
    limparTexto(breadcrumbs.join(" > "));

 const parcelasTexto =
  (await obterTexto(
    page,
    [
      "#installmentCalculator_feature_div",
      "#inemiInstallmentCalculator_feature_div",
      "#creditCardInstallment_feature_div",
      "#paymentFeatures",
      "#desktop_buybox",
      "#buybox",
      "#apex_desktop",
    ].join(", ")
  )) || "";

const textoPagina = await page
  .evaluate(() => document.body.innerText)
  .catch(() => "");

const parcelas =
  (
    parcelasTexto.match(
      /(?:em\s+até\s+)?\d+\s*x\s*de\s*R\$\s*[\d.]+,\d{2}(?:\s*sem\s*juros)?/i
    ) ||
    textoPagina.match(
      /(?:em\s+até\s+)?\d+\s*x\s*de\s*R\$\s*[\d.]+,\d{2}(?:\s*sem\s*juros)?/i
    ) ||
    textoPagina.match(
      /\d+\s*x\s*R\$\s*[\d.]+,\d{2}(?:\s*sem\s*juros)?/i
    )
  )?.[0] || "";

  const freteGratis =
    /frete gr[aá]tis/i.test(textoPagina) ||
    /entrega gr[aá]tis/i.test(textoPagina);

  if (!nome) {
    throw new Error(
      `Nome do produto da Amazon não encontrado. URL final: ${urlFinal}`
    );
  }

  if (!precoAtual) {
    throw new Error(
      `Preço do produto da Amazon não encontrado. URL final: ${urlFinal}`
    );
  }

  const dados = {
    nome,
    categoria,
    loja: "Amazon",
    precoAntigo,
    precoAtual,
    parcelas,
    freteGratis,
    avaliacao,
    vendas: "",
    imagem,
    imagensGaleria,
    urlFinal,
  };

  console.log("[WORKER] Produto Amazon extraído:", dados);

  return dados;
}

module.exports = {
  extrairAmazon,
};