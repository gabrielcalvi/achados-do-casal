export type ReferenciaMercadoLivre =
  | { tipo: "item"; id: string }
  | { tipo: "produto"; id: string };

function normalizarId(id: string): string {
  return id.toUpperCase().replace("-", "");
}

function extrairReferencia(
  valor: string
): ReferenciaMercadoLivre | null {
  let texto = valor;

  try {
    texto = decodeURIComponent(valor);
  } catch {
    // Mantém o valor original quando a URL tem codificação incompleta.
  }

  /*
   * O wid ou item_id representa o anúncio real.
   * Ele deve ter prioridade sobre o PRODUCT_ID do caminho /p/.
   */
  const itemIdParametro = texto.match(
    /[?&#](?:item_id|wid)=(MLB-?\d+)/i
  )?.[1];

  if (itemIdParametro) {
    return {
      tipo: "item",
      id: normalizarId(itemIdParametro),
    };
  }

  const itemIdDireto = texto.match(
    /produto\.mercadolivre\.com\.br\/(MLB-?\d+)/i
  )?.[1];

  if (itemIdDireto) {
    return {
      tipo: "item",
      id: normalizarId(itemIdDireto),
    };
  }

  const productId = texto.match(
    /\/p\/(MLB-?\d+)(?:[/?#]|$)/i
  )?.[1];

  if (productId) {
    return {
      tipo: "produto",
      id: normalizarId(productId),
    };
  }

  return null;
}

export async function resolverItemId(
  url: string
): Promise<ReferenciaMercadoLivre | null> {
  const referenciaOriginal = extrairReferencia(url);

  if (referenciaOriginal) {
    return referenciaOriginal;
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

    const referenciaFinal = extrairReferencia(
      resposta.url
    );

    if (referenciaFinal?.tipo === "item") {
      return referenciaFinal;
    }

    const html = await resposta.text();
    const referenciaHtml =
      extrairReferencia(html);

    return referenciaHtml ?? referenciaFinal;
  } catch (erro) {
    console.error(
      "Erro ao resolver link do Mercado Livre:",
      erro
    );

    return null;
  }
}