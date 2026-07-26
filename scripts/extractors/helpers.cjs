function limparTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarPreco(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  let texto = String(valor)
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!texto) {
    return "";
  }

  if (texto.includes(".") && texto.includes(",")) {
    return texto
      .replace(/\./g, "")
      .replace(",", ".");
  }

  if (texto.includes(",")) {
    return texto.replace(",", ".");
  }

  return texto;
}

function ehProdutoJsonLd(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const tipo = item["@type"];

  if (Array.isArray(tipo)) {
    return tipo.includes("Product");
  }

  return tipo === "Product";
}

function procurarProdutoJsonLd(conteudo) {
  if (ehProdutoJsonLd(conteudo)) {
    return conteudo;
  }

  if (Array.isArray(conteudo)) {
    for (const item of conteudo) {
      const encontrado = procurarProdutoJsonLd(item);

      if (encontrado) {
        return encontrado;
      }
    }

    return null;
  }

  if (conteudo && typeof conteudo === "object") {
    if (conteudo["@graph"]) {
      return procurarProdutoJsonLd(conteudo["@graph"]);
    }
  }

  return null;
}

async function extrairJsonLd(page) {
  const blocos = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents()
    .catch(() => []);

  for (const bloco of blocos) {
    try {
      const conteudo = JSON.parse(bloco);
      const produto = procurarProdutoJsonLd(conteudo);

      if (produto) {
        return produto;
      }
    } catch {
      // Ignora blocos inválidos.
    }
  }

  return null;
}

async function obterTexto(page, seletor) {
  return limparTexto(
    await page
      .locator(seletor)
      .first()
      .textContent()
      .catch(() => "")
  );
}

async function obterAtributo(page, seletor, atributo) {
  return (
    (await page
      .locator(seletor)
      .first()
      .getAttribute(atributo)
      .catch(() => "")) || ""
  );
}

module.exports = {
  limparTexto,
  normalizarPreco,
  extrairJsonLd,
  obterTexto,
  obterAtributo,
};