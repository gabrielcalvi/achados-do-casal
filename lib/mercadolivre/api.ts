import { buscarTokensMercadoLivre } from "@/lib/mercadolivre/token";

export type ProdutoMercadoLivre = {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  category_id: string;
  seller_id: number;
  permalink: string;
  thumbnail: string;
  pictures?: Array<{
    id: string;
    url: string;
    secure_url: string;
  }>;
  shipping?: {
    free_shipping: boolean;
  };
};

export async function buscarProdutoMercadoLivre(
  itemId: string
): Promise<ProdutoMercadoLivre> {
  const tokens = await buscarTokensMercadoLivre();

  if (!tokens?.access_token) {
    throw new Error(
      "Não foi encontrado um token do Mercado Livre no Supabase."
    );
  }

  const idNormalizado = itemId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(
      "O ITEM_ID informado é inválido. Exemplo esperado: MLB1234567890."
    );
  }

  const resposta = await fetch(
    `https://api.mercadolibre.com/items/${idNormalizado}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${tokens.access_token}`,
      },
      cache: "no-store",
    }
  );

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Erro ao consultar produto no Mercado Livre: ${resposta.status} - ${texto}`
    );
  }

  const produto = JSON.parse(texto) as ProdutoMercadoLivre;

  if (!produto?.id) {
    throw new Error(
      "O Mercado Livre não retornou informações válidas para esse produto."
    );
  }

  return produto;
}