import { buscarTokensMercadoLivre } from "@/lib/mercadolivre/token";

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
  const tokens = await buscarTokensMercadoLivre();

  if (!tokens?.access_token) {
    throw new Error(
      "Mercado Livre não está conectado. Autorize a conta novamente no painel."
    );
  }

  const resposta = await fetch(
    `https://api.mercadolibre.com/items/${itemId}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!resposta.ok) {
    const detalhe = await resposta.text();

    console.error(
      "Erro ao buscar produto no Mercado Livre:",
      resposta.status,
      detalhe
    );

    throw new Error(
      `Mercado Livre respondeu ${resposta.status}: ${detalhe}`
    );
  }

  return (await resposta.json()) as ProdutoMercadoLivreApi;
}