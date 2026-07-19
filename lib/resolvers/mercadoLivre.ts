export async function resolverItemId(
  url: string
): Promise<string | null> {
  const direto = url.match(/MLB-?(\d+)/i);

  if (direto) {
    return `MLB${direto[1]}`;
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

    const encontrado = resposta.url.match(/MLB-?(\d+)/i);

    if (encontrado) {
      return `MLB${encontrado[1]}`;
    }

    return null;
  } catch (erro) {
    console.error("Erro ao resolver link do Mercado Livre:", erro);
    return null;
  }
}
