export interface ProdutoMercadoLivreApi {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  thumbnail: string;
  category_id: string;
  permalink: string;
  condition: string;
}

export async function buscarProdutoMercadoLivre(
  itemId: string
): Promise<ProdutoMercadoLivreApi> {
  const resposta = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    {
      cache: "no-store",
    }
  );

  if (!resposta.ok) {
    throw new Error(
      `Mercado Livre respondeu ${resposta.status}`
    );
  }

  return (await resposta.json()) as ProdutoMercadoLivreApi;
}
