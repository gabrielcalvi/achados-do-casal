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

type ProdutoCatalogoMercadoLivre = {
  id: string;
  buy_box_winner?: {
    item_id?: string;
  } | null;
};

async function buscarAccessToken(): Promise<string> {
  const tokens = await buscarTokensMercadoLivre();

  if (!tokens?.access_token) {
    throw new Error(
      "Não foi encontrado um token do Mercado Livre no Supabase."
    );
  }

  return tokens.access_token;
}

function normalizarIdMercadoLivre(id: string): string {
  return id
    .trim()
    .toUpperCase()
    .replace("-", "");
}

export async function buscarProdutoMercadoLivre(
  itemId: string
): Promise<ProdutoMercadoLivre> {
  const accessToken = await buscarAccessToken();
  const idNormalizado = normalizarIdMercadoLivre(itemId);

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`ITEM_ID inválido: ${itemId}`);
  }

  const resposta = await fetch(
    `https://api.mercadolibre.com/items/${idNormalizado}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Mercado Livre respondeu ${resposta.status}: ${texto}`
    );
  }

  try {
    return JSON.parse(texto) as ProdutoMercadoLivre;
  } catch {
    throw new Error(
      "O Mercado Livre retornou uma resposta inválida."
    );
  }
}

export async function buscarItemIdDoCatalogo(
  productId: string
): Promise<string> {
  const accessToken = await buscarAccessToken();
  const idNormalizado = normalizarIdMercadoLivre(productId);

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`PRODUCT_ID inválido: ${productId}`);
  }

  const resposta = await fetch(
    `https://api.mercadolibre.com/products/${idNormalizado}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Mercado Livre respondeu ${resposta.status}: ${texto}`
    );
  }

  let produtoCatalogo: ProdutoCatalogoMercadoLivre;

  try {
    produtoCatalogo =
      JSON.parse(texto) as ProdutoCatalogoMercadoLivre;
  } catch {
    throw new Error(
      "O Mercado Livre retornou uma resposta inválida para o produto de catálogo."
    );
  }

  const itemId =
    produtoCatalogo.buy_box_winner?.item_id;

  if (!itemId) {
    throw new Error(
      "O produto de catálogo não possui um anúncio vencedor disponível."
    );
  }

  return normalizarIdMercadoLivre(itemId);
}