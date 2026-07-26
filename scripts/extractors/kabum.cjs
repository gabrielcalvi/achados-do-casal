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

async function extrairKabum(page, urlProduto) {
  const linkAfiliado = urlProduto;

  await page.goto(urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page.waitForTimeout(3500);

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
        const elementos =
          document.querySelectorAll(seletor);

        for (const elemento of elementos) {
          const texto = elemento.textContent?.trim();

          if (texto) {
            textos.push(texto);
          }
        }
      }

      return textos;
    }

    function atributoDoPrimeiro(
      seletores,
      atributo
    ) {
      for (const seletor of seletores) {
        const elemento =
          document.querySelector(seletor);

        const valor =
          elemento?.getAttribute(atributo);

        if (valor) {
          return valor;
        }
      }

      return "";
    }

    function procurarTipoJsonLd(
      conteudo,
      tipoProcurado
    ) {
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

      for (const valor of Object.values(conteudo)) {
        if (
          valor &&
          typeof valor === "object"
        ) {
          const encontrado = procurarTipoJsonLd(
            valor,
            tipoProcurado
          );

          if (encontrado) {
            return encontrado;
          }
        }
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

    function normalizarImagem(valor) {
      if (
        !valor ||
        typeof valor !== "string"
      ) {
        return "";
      }

      try {
        return new URL(
          valor,
          window.location.href
        ).href;
      } catch {
        return "";
      }
    }

    function obterImagem(elemento) {
      const srcset =
        elemento.getAttribute("srcset") ||
        elemento.getAttribute("data-srcset") ||
        "";

      if (srcset) {
        const opcoes = srcset
          .split(",")
          .map(
            (item) =>
              item.trim().split(/\s+/)[0]
          )
          .filter(Boolean);

        if (opcoes.length) {
          return normalizarImagem(
            opcoes[opcoes.length - 1]
          );
        }
      }

      return normalizarImagem(
        elemento.currentSrc ||
          elemento.src ||
          elemento.getAttribute("data-src") ||
          elemento.getAttribute(
            "data-original"
          ) ||
          elemento.getAttribute(
            "data-lazy-src"
          ) ||
          ""
      );
    }

    function imagemValida(url) {
      if (
        !url ||
        !url.startsWith("http")
      ) {
        return false;
      }

      const texto = url.toLowerCase();

      return !(
        texto.includes("logo") ||
        texto.includes("sprite") ||
        texto.includes("icon") ||
        texto.includes("banner") ||
        texto.includes("placeholder") ||
        texto.includes("loading") ||
        texto.includes("avatar")
      );
    }

    const produto = encontrarJsonLd("Product");

    const breadcrumb = encontrarJsonLd(
      "BreadcrumbList"
    );

    const oferta = Array.isArray(
      produto?.offers
    )
      ? produto.offers[0]
      : produto?.offers;

    const corpo =
      document.body?.innerText || "";

    const nome =
      produto?.name ||
      textoDoPrimeiro([
        "h1",
        '[data-testid="product-title"]',
        '[data-testid="product-name"]',
        '[class*="productTitle"]',
        '[class*="ProductTitle"]',
        '[class*="product-name"]',
      ]);

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
            texto.toLowerCase() !== "home" &&
            texto !== nome
        )
        ?.join(" > ") || "";

    const categoriaDom = Array.from(
      document.querySelectorAll(
        [
          'nav[aria-label*="breadcrumb" i] a',
          '[class*="breadcrumb"] a',
          '[class*="Breadcrumb"] a',
          '[data-testid*="breadcrumb"] a',
        ].join(",")
      )
    )
      .map(
        (elemento) =>
          elemento.textContent?.trim() || ""
      )
      .filter(
        (texto) =>
          texto &&
          texto.toLowerCase() !== "home" &&
          texto !== nome
      )
      .join(" > ");

    const precoPixMatch =
      corpo.match(
        /R\$\s*([\d.]+,\d{2})\s*(?:à vista|no pix|com pix)/i
      ) ||
      corpo.match(
        /por\s+R\$\s*([\d.]+,\d{2})/i
      );

    const precoAtualTexto =
      precoPixMatch?.[1]
        ? `R$ ${precoPixMatch[1]}`
        : textoDoPrimeiro([
            '[itemprop="price"]',
            '[data-testid="price"]',
            '[data-testid="product-price"]',
            '[class*="finalPrice"]',
            '[class*="FinalPrice"]',
            '[class*="currentPrice"]',
            '[class*="CurrentPrice"]',
            '[class*="priceCard"]',
            '[class*="PriceCard"]',
          ]);

    const precosAnteriores =
      textosDosSeletores([
        "del",
        "s",
        '[data-testid="list-price"]',
        '[data-testid="original-price"]',
        '[class*="oldPrice"]',
        '[class*="OldPrice"]',
        '[class*="listPrice"]',
        '[class*="ListPrice"]',
        '[class*="originalPrice"]',
        '[class*="OriginalPrice"]',
      ]);

    const precoDePor =
      corpo.match(
        /de\s+R\$\s*([\d.]+,\d{2})\s+por/i
      );

    if (precoDePor?.[1]) {
      precosAnteriores.push(
        `R$ ${precoDePor[1]}`
      );
    }

    const parcelamento =
      corpo.match(
        /(?:em\s+at[eé]\s+)?\d{1,2}\s*x\s*(?:de\s*)?R\$\s*[\d.,]+(?:\s*sem\s*juros)?/i
      ) ||
      corpo.match(
        /\d{1,2}\s*vezes\s*(?:de\s*)?R\$\s*[\d.,]+(?:\s*sem\s*juros)?/i
      );

    const imagensJsonOriginais =
      Array.isArray(produto?.image)
        ? produto.image
        : produto?.image
          ? [produto.image]
          : [];

    const imagensJson =
      imagensJsonOriginais
        .map((imagem) => {
          if (typeof imagem === "string") {
            return normalizarImagem(imagem);
          }

          return normalizarImagem(
            imagem?.url ||
              imagem?.contentUrl ||
              imagem?.["@id"] ||
              ""
          );
        })
        .filter(imagemValida);

    const imagensDom = Array.from(
      document.querySelectorAll(
        [
          '[class*="gallery"] img',
          '[class*="Gallery"] img',
          '[class*="carousel"] img',
          '[class*="Carousel"] img',
          '[class*="productImage"] img',
          '[class*="ProductImage"] img',
          '[class*="thumbnail"] img',
          '[class*="Thumbnail"] img',
          '[data-testid*="gallery"] img',
          '[data-testid*="image"] img',
        ].join(",")
      )
    )
      .map(obterImagem)
      .filter(imagemValida);

    const imagemMeta =
      atributoDoPrimeiro(
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
        '[data-testid*="rating"]',
        '[class*="rating"]',
        '[class*="Rating"]',
      ]);

    return {
      nome,

      categoria:
        produto?.category ||
        categoriaJson ||
        categoriaDom,

      precoJson:
        oferta?.price ||
        oferta?.lowPrice ||
        oferta?.highPrice ||
        null,

      precoAtualTexto,
      precosAnteriores,

      parcelas: parcelamento
        ? parcelamento[0]
        : "",

      avaliacao,

      freteGratis:
        /frete\s+gr[aá]tis/i.test(corpo),

      imagens: [
        imagemMeta,
        ...imagensJson,
        ...imagensDom,
      ],

      descricao:
        produto?.description ||
        textoDoPrimeiro([
          '[itemprop="description"]',
          '[data-testid*="description"]',
          '[class*="description"]',
          '[class*="Description"]',
        ]),
    };
  });

  const precoAtual =
    converterPreco(dados.precoJson) ??
    converterPreco(dados.precoAtualTexto);

  const precoAnterior = escolherPrecoAnterior(
    dados.precosAnteriores || [],
    precoAtual
  );

  const imagensGaleria = listaUnica(
    dados.imagens || []
  );

  return {
    nome: limparTexto(dados.nome),
    categoria: limparTexto(dados.categoria),
    loja: "Kabum",

    precoAnterior,
    precoAtual,

    parcelas: limparTexto(dados.parcelas),
    parcelamento: limparTexto(
      dados.parcelas
    ),

    freteGratis: Boolean(
      dados.freteGratis
    ),

    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    galeria: imagensGaleria,

    avaliacao: converterPreco(
      dados.avaliacao
    ),

    vendas: "",

    descricao: limparTexto(
      dados.descricao
    ),

    linkAfiliado,
    urlFinal: page.url(),
  };
}

module.exports = {
  extrairKabum,
};