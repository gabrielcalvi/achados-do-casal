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

export async function buscarProdutoMercadoLivre(itemId: string) {
  const resposta = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    {
      cache: "no-store",
    }
  );

  if (!resposta.ok) {
  const corpo = await resposta.text();

  console.error("Status:", resposta.status);
  console.error("Body:", corpo);

  throw new Error(
    `Mercado Livre respondeu ${resposta.status}: ${corpo}`
  );
}

  return (await resposta.json()) as ProdutoMercadoLivreApi;
}