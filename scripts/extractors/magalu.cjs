function limparTexto(valor) {
  return typeof valor === "string"
    ? valor.replace(/\s+/g, " ").trim()
    : "";
}

function converterPreco(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const texto = String(valor)
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!texto) {
    return null;
  }

  let normalizado = texto;

  if (texto.includes(",") && texto.includes(".")) {
    normalizado = texto
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (texto.includes(",")) {
    normalizado = texto.replace(",", ".");
  }

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : null;
}

function listaUnica(lista) {
  return [
    ...new Set(
      lista.filter(
        (item) =>
          typeof item === "string" &&
          item.trim() &&
          item.startsWith("http")
      )
    ),
  ];
}

function escolherPrecoAnterior(candidatos, precoAtual) {
  const valores = candidatos
    .map(converterPreco)
    .filter(
      (valor) =>
        valor !== null &&
        valor > 0 &&
        (!precoAtual || valor > precoAtual)
    );

  if (!valores.length) {
    return null;
  }

  return Math.max(...valores);
}

async function extrairMagalu(page, urlProduto) {
  await page.goto(urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page.waitForTimeout(3000);

  const dados = await page.evaluate(() => {
    function textoDoPrimeiro(seletores) {
      for (const seletor of seletores) {
        const elemento = document.querySelector(seletor);

        if (elemento?.textContent?.trim()) {
          return elemento.textContent.trim();
        }
      }

      return "";
    }

    function textosDosSeletores(seletores) {
      const textos = [];

      for (const seletor of seletores) {
        const elementos = document.querySelectorAll(seletor);

        for (const elemento of elementos) {
          const texto = elemento.textContent?.trim();

          if (texto) {
            textos.push(texto);
          }
        }
      }

      return textos;
    }

    function atributoDoPrimeiro(seletores, atributo) {
      for (const seletor of seletores) {
        const elemento = document.querySelector(seletor);
        const valor = elemento?.getAttribute(atributo);

        if (valor) {
          return valor;
        }
      }

      return "";
    }

    function procurarTipoJsonLd(conteudo, tipoProcurado) {
      if (!conteudo) {
        return null;
      }

      if (Array.isArray(conteudo)) {
        for (const item of conteudo) {
          const encontrado = procurarTipoJsonLd(
            item,
            tipoProcurado
          );

          if (encontrado) {
            return encontrado;
          }
        }

        return null;
      }

      if (typeof conteudo !== "object") {
        return null;
      }

      const tipo = conteudo["@type"];

      if (
        tipo === tipoProcurado ||
        (Array.isArray(tipo) &&
          tipo.includes(tipoProcurado))
      ) {
        return conteudo;
      }

      if (conteudo["@graph"]) {
        return procurarTipoJsonLd(
          conteudo["@graph"],
          tipoProcurado
        );
      }

      return null;
    }

    function encontrarJsonLd(tipoProcurado) {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );

      for (const script of scripts) {
        try {
          const conteudo = JSON.parse(
            script.textContent || "{}"
          );

          const encontrado = procurarTipoJsonLd(
            conteudo,
            tipoProcurado
          );

          if (encontrado) {
            return encontrado;
          }
        } catch {
          // Ignora JSON-LD inválido.
        }
      }

      return null;
    }

    function normalizarUrlImagem(valor) {
      if (!valor || typeof valor !== "string") {
        return "";
      }

      try {
        return new URL(valor, window.location.href).href;
      } catch {
        return "";
      }
    }

    function srcDaImagem(imagem) {
      const srcset =
        imagem.getAttribute("srcset") ||
        imagem.getAttribute("data-srcset") ||
        "";

      if (srcset) {
        const opcoes = srcset
          .split(",")
          .map((item) => item.trim().split(/\s+/)[0])
          .filter(Boolean);

        if (opcoes.length) {
          return normalizarUrlImagem(
            opcoes[opcoes.length - 1]
          );
        }
      }

      return normalizarUrlImagem(
        imagem.currentSrc ||
          imagem.src ||
          imagem.getAttribute("data-src") ||
          imagem.getAttribute("data-original") ||
          imagem.getAttribute("data-lazy") ||
          ""
      );
    }

    function imagemJsonParaUrl(imagem) {
      if (typeof imagem === "string") {
        return normalizarUrlImagem(imagem);
      }

      if (imagem && typeof imagem === "object") {
        return normalizarUrlImagem(
          imagem.url ||
            imagem.contentUrl ||
            imagem["@id"] ||
            ""
        );
      }

      return "";
    }

    function imagemValida(url) {
      if (!url || !url.startsWith("http")) {
        return false;
      }

      const texto = url.toLowerCase();

      return !(
        texto.includes("logo") ||
        texto.includes("sprite") ||
        texto.includes("icon") ||
        texto.includes("banner") ||
        texto.includes("avatar") ||
        texto.includes("placeholder") ||
        texto.includes("loading")
      );
    }

    const produto = encontrarJsonLd("Product");
    const breadcrumb = encontrarJsonLd(
      "BreadcrumbList"
    );

    const oferta = Array.isArray(produto?.offers)
      ? produto.offers[0]
      : produto?.offers;

    const corpo = document.body?.innerText || "";

    const nome =
      produto?.name ||
      textoDoPrimeiro([
        "h1",
        '[data-testid="heading-product-title"]',
        '[data-testid="product-title"]',
        '[class*="product-title"]',
        '[class*="ProductTitle"]',
      ]);

    const codigoProduto =
      corpo.match(/C[oó]digo\s*:?\s*(\d+)/i)?.[1] || "";

    const itensBreadcrumbDom = Array.from(
      document.querySelectorAll(
        [
          '[class*="breadcrumb"] a',
          '[class*="Breadcrumb"] a',
          'nav[aria-label*="breadcrumb" i] a',
          '[data-testid*="breadcrumb"] a',
        ].join(",")
      )
    )
      .map((item) => item.textContent?.trim() || "")
      .filter(
        (texto) =>
          texto &&
          texto.toLowerCase() !== "início" &&
          texto.toLowerCase() !==
            "influenciador magalu" &&
          texto !== nome
      );

    const categoriaJson =
      breadcrumb?.itemListElement
        ?.map(
          (item) =>
            item?.name ||
            item?.item?.name ||
            ""
        )
        ?.filter(
          (texto) =>
            texto &&
            texto.toLowerCase() !== "início" &&
            texto !== nome
        )
        ?.join(" > ") || "";

    const categoria =
      produto?.category ||
      categoriaJson ||
      itensBreadcrumbDom.join(" > ");

    const precoPixMatch =
      corpo.match(
        /ou\s+R\$\s*([\d.]+,\d{2})\s+no\s+Pix/i
      ) ||
      corpo.match(
        /R\$\s*([\d.]+,\d{2})\s+no\s+Pix/i
      );

    const precoAtualTexto =
      precoPixMatch?.[1]
        ? `R$ ${precoPixMatch[1]}`
        : textoDoPrimeiro([
            '[data-testid="price-value"]',
            '[data-testid="product-price"]',
            '[data-testid="price"]',
            '[itemprop="price"]',
            '[class*="price-value"]',
            '[class*="PriceValue"]',
          ]);

    const precoAntesParcelamento =
      corpo.match(
        /R\$\s*([\d.]+,\d{2})\s*(?:\r?\n|\s)+\d{1,2}x\s+de\s+R\$/i
      );

    const precoDePor =
      corpo.match(
        /de\s+R\$\s*([\d.]+,\d{2})\s+por\s+R\$/i
      );

    const precosAnterioresDom =
      textosDosSeletores([
        "del",
        "s",
        '[data-testid="price-original"]',
        '[data-testid="original-price"]',
        '[class*="old-price"]',
        '[class*="OldPrice"]',
        '[class*="original-price"]',
        '[class*="OriginalPrice"]',
        '[class*="price-old"]',
        '[class*="PriceOld"]',
      ]);

    const candidatosPrecoAnterior = [
      ...precosAnterioresDom,
      precoAntesParcelamento?.[1]
        ? `R$ ${precoAntesParcelamento[1]}`
        : "",
      precoDePor?.[1]
        ? `R$ ${precoDePor[1]}`
        : "",
    ];

    const parcelamentoMatch =
      corpo.match(
        /(\d{1,2})\s*x\s*de\s*R\$\s*[\d.,]+(?:\s*sem\s*juros)?/i
      ) ||
      corpo.match(
        /(\d{1,2})\s*vez(?:es)?\s*de\s*R\$\s*[\d.,]+(?:\s*sem\s*juros)?/i
      );

    const imagensJsonOriginais = Array.isArray(
      produto?.image
    )
      ? produto.image
      : produto?.image
        ? [produto.image]
        : [];

    const imagensJson = imagensJsonOriginais
      .map(imagemJsonParaUrl)
      .filter(imagemValida);

    const seletoresGaleria = [
      '[class*="gallery"] img',
      '[class*="Gallery"] img',
      '[class*="carousel"] img',
      '[class*="Carousel"] img',
      '[class*="product-image"] img',
      '[class*="ProductImage"] img',
      '[class*="thumbnail"] img',
      '[class*="Thumbnail"] img',
      '[data-testid*="gallery"] img',
      '[data-testid*="image"] img',
    ];

    const imagensGaleriaDom = Array.from(
      document.querySelectorAll(
        seletoresGaleria.join(",")
      )
    )
      .map(srcDaImagem)
      .filter(imagemValida);

    const imagensPorCodigo = codigoProduto
      ? Array.from(document.querySelectorAll("img"))
          .map(srcDaImagem)
          .filter(
            (url) =>
              imagemValida(url) &&
              url.includes(codigoProduto)
          )
      : [];

    const imagensDom = Array.from(
      document.querySelectorAll("img")
    )
      .map(srcDaImagem)
      .filter((url) => {
        if (!imagemValida(url)) {
          return false;
        }

        const texto = url.toLowerCase();

        return (
          texto.includes("mlcdn.com.br") ||
          texto.includes("magazineluiza") ||
          texto.includes("magazinevoce")
        );
      });

    const imagemMeta = atributoDoPrimeiro(
      ['meta[property="og:image"]'],
      "content"
    );

    const avaliacao =
      produto?.aggregateRating?.ratingValue ||
      atributoDoPrimeiro(
        ['meta[itemprop="ratingValue"]'],
        "content"
      ) ||
      atributoDoPrimeiro(
        ['[itemprop="ratingValue"]'],
        "content"
      ) ||
      textoDoPrimeiro([
        '[data-testid="rating"]',
        '[data-testid="review-rating"]',
        '[class*="rating"]',
        '[class*="Rating"]',
      ]);

    return {
      nome,
      categoria,

      precoJson:
        oferta?.price ||
        oferta?.lowPrice ||
        oferta?.highPrice ||
        null,

      precoAtualTexto,
      candidatosPrecoAnterior,

      parcelas: parcelamentoMatch
        ? parcelamentoMatch[0]
        : "",

      avaliacao,

      freteGratis:
        /frete\s+gr[aá]tis/i.test(corpo),

      imagens: [
        imagemMeta,
        ...imagensJson,
        ...imagensPorCodigo,
        ...imagensGaleriaDom,
        ...imagensDom,
      ],

      descricao:
        produto?.description ||
        textoDoPrimeiro([
          '[itemprop="description"]',
          '[data-testid="description"]',
          '[class*="description"]',
          '[class*="Description"]',
        ]),
    };
  });

  const precoAtual =
    converterPreco(dados.precoJson) ??
    converterPreco(dados.precoAtualTexto);

  const precoAnterior = escolherPrecoAnterior(
    dados.candidatosPrecoAnterior || [],
    precoAtual
  );

  const imagensGaleria = listaUnica(
    dados.imagens || []
  );

  const urlFinal = page.url();

  return {
    nome: limparTexto(dados.nome),
    categoria: limparTexto(dados.categoria),
    loja: "Magazine Luiza",

    precoAnterior,
    precoAtual,

    parcelas: limparTexto(dados.parcelas),
    parcelamento: limparTexto(dados.parcelas),

    freteGratis: Boolean(dados.freteGratis),

    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    galeria: imagensGaleria,

    avaliacao: converterPreco(dados.avaliacao),
    vendas: "",

    descricao: limparTexto(dados.descricao),

    linkAfiliado: urlFinal,
    urlFinal,
  };
}

module.exports = {
  extrairMagalu,
};