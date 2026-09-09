import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

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

export type ProdutoCatalogoMercadoLivre = {
  id: string;
  name?: string | null;
  permalink?: string | null;
  status?: string | null;
  parent_id?: string | null;
  children_ids?: string[];
  pictures?: Array<{
    id?: string;
    url?: string;
    secure_url?: string;
  }>;
  buy_box_winner?: {
    item_id?: string;
    price?: number;
    currency_id?: string;
    seller_id?: number;
    available_quantity?: number;
  } | null;
};

export type ItemCatalogoMercadoLivre = {
  item_id: string;
  site_id?: string;
  seller_id?: number;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  original_price?: number | null;
  condition?: string;
  listing_type_id?: string;
};

type ListaItensCatalogoMercadoLivre = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: ItemCatalogoMercadoLivre[];
};

function normalizarIdMercadoLivre(id: string): string {
  return id
    .trim()
    .toUpperCase()
    .replace(/-/g, "");
}

async function fetchJsonMercadoLivre<T>(url: string): Promise<T> {
  const accessToken = await obterAccessTokenMercadoLivre();
  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`Mercado Livre respondeu ${resposta.status}: ${texto}`);
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error("O Mercado Livre retornou uma resposta inválida.");
  }
}

export async function buscarProdutoMercadoLivre(
  itemId: string
): Promise<ProdutoMercadoLivre> {
  const idNormalizado = normalizarIdMercadoLivre(itemId);

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`ITEM_ID inválido: ${itemId}`);
  }

  return fetchJsonMercadoLivre<ProdutoMercadoLivre>(
    `https://api.mercadolibre.com/items/${idNormalizado}`
  );
}

export async function buscarProdutoCatalogoMercadoLivre(
  productId: string
): Promise<ProdutoCatalogoMercadoLivre> {
  const idNormalizado = normalizarIdMercadoLivre(productId);

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`PRODUCT_ID inválido: ${productId}`);
  }

  return fetchJsonMercadoLivre<ProdutoCatalogoMercadoLivre>(
    `https://api.mercadolibre.com/products/${idNormalizado}`
  );
}

export async function buscarItensDoCatalogoMercadoLivre(
  productId: string
): Promise<ListaItensCatalogoMercadoLivre> {
  const idNormalizado = normalizarIdMercadoLivre(productId);

  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`PRODUCT_ID inválido: ${productId}`);
  }

  return fetchJsonMercadoLivre<ListaItensCatalogoMercadoLivre>(
    `https://api.mercadolibre.com/products/${idNormalizado}/items`
  );
}

export async function buscarItemIdDoCatalogo(
  productId: string
): Promise<string> {
  const produtoCatalogo = await buscarProdutoCatalogoMercadoLivre(productId);
  const itemId = produtoCatalogo.buy_box_winner?.item_id;

  if (!itemId) {
    throw new Error(
      "O produto de catálogo não possui um anúncio vencedor disponível."
    );
  }

  return normalizarIdMercadoLivre(itemId);
}
