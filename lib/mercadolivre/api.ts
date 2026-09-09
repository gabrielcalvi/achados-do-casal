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
  domain_id?: string | null;
  pictures?: Array<{
    id?: string;
    url?: string;
    secure_url?: string;
  }>;
  buy_box_winner?: {
    item_id?: string;
    price?: number;
    original_price?: number | null;
    currency_id?: string;
    seller_id?: number;
    available_quantity?: number;
    sold_quantity?: number;
    shipping?: {
      free_shipping?: boolean;
    };
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
  category_id?: string;
  user_product_id?: string;
  condition?: string;
  listing_type_id?: string;
  shipping?: {
    free_shipping?: boolean;
    cost?: number;
  };
};

type ListaItensCatalogoMercadoLivre = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: ItemCatalogoMercadoLivre[];
};

type BuscaProdutosCatalogoMercadoLivre = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: ProdutoCatalogoMercadoLivre[];
};

type BuscaItensMercadoLivre = {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
  results?: ProdutoMercadoLivre[];
};

type RespostaBulkItemMercadoLivre = {
  id?: string;
  status_code?: number;
  body?: ProdutoMercadoLivre & {
    status?: string;
    available_quantity?: number;
    catalog_product_id?: string | null;
  };
};

function normalizarIdMercadoLivre(id: string): string {
  return id.trim().toUpperCase().replace(/-/g, "");
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

export async function buscarProdutoMercadoLivreBulk(
  itemId: string
): Promise<
  | (ProdutoMercadoLivre & {
      status?: string;
      available_quantity?: number;
      catalog_product_id?: string | null;
    })
  | null
> {
  const idNormalizado = normalizarIdMercadoLivre(itemId);
  if (!/^MLB\d+$/.test(idNormalizado)) {
    throw new Error(`ITEM_ID inválido: ${itemId}`);
  }

  const resposta = await fetchJsonMercadoLivre<RespostaBulkItemMercadoLivre[]>(
    `https://api.mercadolibre.com/items/bulk?ids=${idNormalizado}&attributes=body.id,body.title,body.price,body.original_price,body.currency_id,body.permalink,body.thumbnail,body.status,body.available_quantity,body.catalog_product_id`
  );

  const entrada = Array.isArray(resposta) ? resposta[0] : null;
  if (!entrada || entrada.status_code !== 200 || !entrada.body) return null;
  return entrada.body;
}

export async function buscarItensMercadoLivrePorTexto(
  texto: string,
  limite = 50
): Promise<ProdutoMercadoLivre[]> {
  const termo = String(texto || "").trim();
  if (!termo) return [];

  const resposta = await fetchJsonMercadoLivre<BuscaItensMercadoLivre>(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=${Math.max(1, Math.min(50, limite))}`
  );

  return Array.isArray(resposta.results) ? resposta.results : [];
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

export async function buscarProdutosCatalogoMercadoLivre(
  texto: string,
  limite = 8
): Promise<ProdutoCatalogoMercadoLivre[]> {
  const termo = String(texto || "").trim();
  if (!termo) return [];

  const resposta = await fetchJsonMercadoLivre<BuscaProdutosCatalogoMercadoLivre>(
    `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(termo)}&limit=${Math.max(1, Math.min(20, limite))}`
  );

  return Array.isArray(resposta.results) ? resposta.results : [];
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

export async function buscarItensDoUserProductMercadoLivre(
  userProductId: string
): Promise<ListaItensCatalogoMercadoLivre> {
  const idNormalizado = normalizarIdMercadoLivre(userProductId);

  if (!/^MLBU\d+$/.test(idNormalizado)) {
    throw new Error(`USER_PRODUCT_ID inválido: ${userProductId}`);
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
