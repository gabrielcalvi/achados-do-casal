const {
  limparTexto,
  normalizarPreco,
  extrairJsonLd,
  obterTexto,
  obterAtributo,
} = require("./helpers.cjs");

function extrairTermoBuscaUrl(urlProduto) {
  try {
    const url = new URL(urlProduto);
    const partes = url.pathname.split("/").filter(Boolean);
    const indiceMarcador = partes.findIndex((parte) => /^(p|up)$/i.test(parte));
    let slug = indiceMarcador > 0 ? partes[indiceMarcador - 1] : partes[0] || "";

    slug = slug
      .replace(/^MLB-?\d+-/i, "")
      .replace(/-_JM$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return decodeURIComponent(slug);
  } catch {
    return "";
  }
}

function extrairIdsUrl(urlProduto) {
  const texto = String(urlProduto || "");
  return {
    itemId:
      texto.match(/(?:MLB-?\d{8,})/i)?.[0]?.replace(/-/g, "").toUpperCase() || "",
    userProductId:
      texto.match(/(?:MLBU-?\d{6,})/i)?.[0]?.replace(/-/g, "").toUpperCase() || "",
  };
}

function paginaBloqueada(page) {
  const atual = page.url();
  return (
    atual.includes("/gz/account-verification") ||
    atual.includes("/captcha/") ||
    atual.includes("/account-verification")
  );
}

async function navegarViaBuscaMercadoLivre(page, urlProduto) {
  const termo = extrairTermoBuscaUrl(urlProduto);
  const ids = extrairIdsUrl(urlProduto);

  if (!termo) return false;

  console.log("[WORKER] Tentando navegação alternativa via busca:", termo);

  await page.goto("https://www.mercadolivre.com.br", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page.waitForTimeout(1500);

  const campoBusca = page
    .locator('input.nav-search-input, input[name="as_word"], input[placeholder*="Buscar"]')
    .first();

  if (await campoBusca.count()) {
    await campoBusca.fill(termo);
    await campoBusca.press("Enter");
    await page.waitForLoadState("domcontentloaded", { timeout: 45000 }).catch(() => undefined);
  } else {
    const slugBusca = termo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    await page.goto(`https://lista.mercadolivre.com.br/${slugBusca}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
  }

  await page.waitForTimeout(1800);

  if (paginaBloqueada(page)) {
    return false;
  }

  let linkProduto = null;

  if (ids.userProductId) {
    linkProduto = page.locator(`a[href*="${ids.userProductId}"]`).first();
  }

  if ((!linkProduto || !(await linkProduto.count())) && ids.itemId) {
    linkProduto = page.locator(`a[href*="${ids.itemId}"]`).first();
  }

  if (!linkProduto || !(await linkProduto.count())) {
    const palavras = termo
      .split(" ")
      .filter((palavra) => palavra.length > 3)
      .slice(0, 5);

    const candidatos = page.locator(
      'a.poly-component__title, a.ui-search-link, a[href*="/up/"], a[href*="produto.mercadolivre.com.br"]'
    );

    const total = await candidatos.count();

    for (let i = 0; i < Math.min(total, 40); i += 1) {
      const candidato = candidatos.nth(i);
      const texto = limparTexto(await candidato.textContent().catch(() => ""));
      const comuns = palavras.filter((palavra) =>
        texto.toLowerCase().includes(palavra.toLowerCase())
      ).length;

      if (palavras.length && comuns / palavras.length >= 0.6) {
        linkProduto = candidato;
        break;
      }
    }
  }

  if (!linkProduto || !(await linkProduto.count())) {
    return false;
  }

  const href = await linkProduto.getAttribute("href").catch(() => "");
  if (!href) return false;

  await page.goto(href, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page
    .locator(
      'h1.ui-pdp-title, .ui-pdp-price__main-container, script[type="application/ld+json"]'
    )
    .first()
    .waitFor({ state: "attached", timeout: 20000 })
    .catch(() => undefined);

  return !paginaBloqueada(page);
}

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

async function extrairPrecoPrincipalVisivel(page) {
  const precoSegundaLinha = await extrairValorMonetario(
    page,
    ".ui-pdp-price__second-line"
  );

  if (precoSegundaLinha) {
    return {
      preco: precoSegundaLinha,
      origem: "dom_second_line",
    };
  }

  const candidatos = await page
    .locator(".ui-pdp-price__main-container .andes-money-amount")
    .evaluateAll((elementos) => {
      function valorDoElemento(elemento) {
        const inteiro =
          elemento.querySelector(".andes-money-amount__fraction")?.textContent || "";
        const centavos =
          elemento.querySelector(".andes-money-amount__cents")?.textContent || "";

        return {
          inteiro: inteiro.replace(/\s+/g, " ").trim(),
          centavos: centavos.replace(/\s+/g, " ").trim(),
        };
      }

      return elementos.map((elemento, indice) => {
        const valor = valorDoElemento(elemento);
        const original = Boolean(
          elemento.closest(".ui-pdp-price__original-value, del, s")
        );
        const segundaLinha = Boolean(
          elemento.closest(".ui-pdp-price__second-line")
        );

        const linha =
          elemento.closest(".ui-pdp-price__second-line") ||
          elemento.parentElement?.parentElement ||
          elemento.parentElement ||
          elemento;

        const contexto = String(linha.textContent || "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          ...valor,
          indice,
          original,
          segundaLinha,
          pix: /\bpix\b/i.test(contexto),
          parcelado: /\b\d+\s*x\b/i.test(contexto),
          contexto,
        };
      });
    })
    .catch(() => []);

  const validos = candidatos
    .map((item) => ({
      ...item,
      preco: normalizarPreco(
        item.centavos
          ? `${item.inteiro},${item.centavos}`
          : item.inteiro
      ),
    }))
    .filter(
      (item) =>
        item.preco &&
        !item.original &&
        !item.parcelado &&
        Number(item.preco) > 0
    );

  const escolhido =
    validos.find((item) => item.pix) ||
    validos.find((item) => item.segundaLinha) ||
    validos[0];

  return escolhido
    ? {
        preco: escolhido.preco,
        origem: escolhido.pix ? "dom_pix" : "dom_main_price",
      }
    : {
        preco: "",
        origem: "",
      };
}

async function extrairMercadoLivre(page, urlProduto) {
  console.log("[WORKER] Extraindo Mercado Livre:", urlProduto);

  await page.bringToFront();

  await page.goto(urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  console.log("[WORKER] page.goto() concluído");

  await page
    .locator(
      'h1.ui-pdp-title, .ui-pdp-price__main-container, script[type="application/ld+json"]'
    )
    .first()
    .waitFor({
      state: "attached",
      timeout: 20000,
    })
    .catch(() => undefined);

  let urlFinal = page.url();

  if (paginaBloqueada(page)) {
    const recuperou = await navegarViaBuscaMercadoLivre(page, urlProduto);

    if (!recuperou) {
      throw new Error(
        "O Mercado Livre solicitou uma nova verificação de segurança."
      );
    }

    urlFinal = page.url();
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

  const precoVisivel = await extrairPrecoPrincipalVisivel(page);
  const precoJson =
    normalizarPreco(oferta?.price) ||
    normalizarPreco(oferta?.lowPrice);

  const precoAtual = precoVisivel.preco || precoJson;
  const precoOrigem = precoVisivel.preco
    ? precoVisivel.origem
    : precoJson
      ? "json_ld"
      : "";

  let precoAntigo =
    (await extrairValorMonetario(
      page,
      ".ui-pdp-price__original-value"
    )) ||
    normalizarPreco(oferta?.highPrice);

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
      `Nome do produto não encontrado. URL final: ${urlFinal}`
    );
  }

  if (!precoAtual) {
    throw new Error(
      `Preço do produto não encontrado. URL final: ${urlFinal}`
    );
  }

  const dados = {
    nome,
    categoria,
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    precoOrigem,
    parcelas,
    freteGratis,
    imagem,
    imagensGaleria,
    avaliacao,
    vendas,
    urlFinal,
  };

  console.log("[WORKER] Produto Mercado Livre extraído:", dados);

  return dados;
}

module.exports = {
  extrairMercadoLivre,
};