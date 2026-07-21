function extrairItemId(valor: string): string | null {
  const texto = decodeURIComponent(valor);

  const itemIdParametro =
    texto.match(/[?&](?:item_id|wid)=(MLB-?\d+)/i)?.[1];

  if (itemIdParametro) {
    return itemIdParametro.toUpperCase().replace("-", "");
  }

  const anuncioDireto =
    texto.match(
      /produto\.mercadolivre\.com\.br\/(MLB-?\d+)/i
    )?.[1];

  if (anuncioDireto) {
    return anuncioDireto.toUpperCase().replace("-", "");
  }

  return null;
}

export async function resolverItemId(
  url: string
): Promise<string | null> {
  const itemIdOriginal = extrairItemId(url);

  if (itemIdOriginal) {
    return itemIdOriginal;
  }

  try {
    const resposta = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      },
    });

    const itemIdFinal = extrairItemId(resposta.url);

    if (itemIdFinal) {
      return itemIdFinal;
    }

    const html = await resposta.text();

    const itemIdDoHtml =
      html.match(
        /"(?:item_id|itemId|id)"\s*:\s*"(MLB-?\d{8,})"/i
      )?.[1] ??
      html.match(
        /produto\.mercadolivre\.com\.br\/(MLB-?\d+)/i
      )?.[1];

    if (itemIdDoHtml) {
      return itemIdDoHtml.toUpperCase().replace("-", "");
    }

    return null;
  } catch (erro) {
    console.error(
      "Erro ao resolver link do Mercado Livre:",
      erro
    );

    return null;
  }
}