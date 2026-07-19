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
  id?: string;
  name?: string;
  title?: string;
  domain_id?: string;
  category_id?: string;
  pictures?: Array<{
    id?: string;
    url?: string;
    secure_url?: string;
  }>;
};

type AnuncioCatalogoMercadoLivre = {
  id?: string;
  item_id?: string;
  title?: string;
  price?: number;
  original_price?: number | null;
  currency_id?: string;
  category_id?: string;
  seller_id?: number;
  permalink?: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  status?: string;
  available_quantity?: number;
  pictures?: Array<{
    id?: string;
    url?: string;
    secure_url?: string;
  }>;
  shipping?: {
    free_shipping?: boolean;
  };
};

type RespostaAnunciosCatalogo =
  | AnuncioCatalogoMercadoLivre[]
  | {
      results?: AnuncioCatalogoMercadoLivre[];
      items?: AnuncioCatalogoMercadoLivre[];
    };

function extrairInformacoesProduto(valor: string) {
  const texto = valor.trim();

  const productIdDaUrl =
    texto.match(/\/p\/(MLB\d+)/i)?.[1] ??
    texto.match(/products\/(MLB\d+)/i)?.[1];

  const itemIdDaUrl =
    texto.match(/[?&]item_id[:=](MLB\d+)/i)?.[1] ??
    texto.match(/produto\.mercadolivre\.com\.br\/(MLB\d+)/i)?.[1];

  const idDireto = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const productId =
    productIdDaUrl?.toUpperCase() ??
    (/^MLB\d+$/.test(idDireto) ? idDireto : null);

  return {
    productId,
    itemIdPreferido: itemIdDaUrl?.toUpperCase() ?? null,
  };
}

async function consultarMercadoLivre<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Erro ao consultar o Mercado Livre: ${resposta.status} - ${texto}`
    );
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error(
      "O Mercado Livre retornou uma resposta que não está em formato JSON."
    );
  }
}

function obterListaDeAnuncios(
  resposta: RespostaAnunciosCatalogo
): AnuncioCatalogoMercadoLivre[] {
  if (Array.isArray(resposta)) {
    return resposta;
  }

  if (Array.isArray(resposta.results)) {
    return resposta.results;
  }

  if (Array.isArray(resposta.items)) {
    return resposta.items;
  }

  return [];
}

function obterIdAnuncio(anuncio: AnuncioCatalogoMercadoLivre): string {
  return String(anuncio.id ?? anuncio.item_id ?? "")
    .trim()
    .toUpperCase();
}

function escolherAnuncio(
  anuncios: AnuncioCatalogoMercadoLivre[],
  itemIdPreferido: string | null
): AnuncioCatalogoMercadoLivre {
  if (itemIdPreferido) {
    const anuncioDoLink = anuncios.find(
      (anuncio) => obterIdAnuncio(anuncio) === itemIdPreferido
    );

    if (anuncioDoLink) {
      return anuncioDoLink;
    }
  }

  const anunciosDisponiveis = anuncios.filter((anuncio) => {
    const ativo = !anuncio.status || anuncio.status === "active";
    const disponivel =
      anuncio.available_quantity === undefined ||
      anuncio.available_quantity > 0;
    const possuiPreco =
      typeof anuncio.price === "number" && anuncio.price > 0;

    return ativo && disponivel && possuiPreco;
  });

  const candidatos =
    anunciosDisponiveis.length > 0 ? anunciosDisponiveis : anuncios;

  const ordenados = [...candidatos].sort((a, b) => {
    const precoA =
      typeof a.price === "number"
        ? a.price
        : Number.POSITIVE_INFINITY;

    const precoB =
      typeof b.price === "number"
        ? b.price
        : Number.POSITIVE_INFINITY;

    return precoA - precoB;
  });

  const anuncio = ordenados[0];

  if (!anuncio) {
    throw new Error(
      "O Mercado Livre não retornou anúncios para esse produto de catálogo."
    );
  }

  return anuncio;
}

export async function buscarProdutoMercadoLivre(
  produtoIdOuLink: string
): Promise<ProdutoMercadoLivre> {
  const tokens = await buscarTokensMercadoLivre();

  if (!tokens?.access_token) {
    throw new Error(
      "Não foi encontrado um token do Mercado Livre no Supabase."
    );
  }

  const { productId, itemIdPreferido } =
    extrairInformacoesProduto(produtoIdOuLink);

  if (!productId) {
    throw new Error(
      "Não foi encontrado um código de catálogo válido. Informe um código como MLB29001054 ou cole o link completo do produto."
    );
  }

  const [produtoCatalogo, respostaAnuncios] = await Promise.all([
    consultarMercadoLivre<ProdutoCatalogoMercadoLivre>(
      `https://api.mercadolibre.com/products/${productId}`,
      tokens.access_token
    ),
    consultarMercadoLivre<RespostaAnunciosCatalogo>(
      `https://api.mercadolibre.com/products/${productId}/items`,
      tokens.access_token
    ),
  ]);

  const anuncios = obterListaDeAnuncios(respostaAnuncios);
  const anuncio = escolherAnuncio(anuncios, itemIdPreferido);

  const idAnuncio = obterIdAnuncio(anuncio);

  if (!idAnuncio) {
    throw new Error(
      "O anúncio selecionado não possui um ITEM_ID válido."
    );
  }

  const titulo =
    produtoCatalogo.name ??
    produtoCatalogo.title ??
    anuncio.title ??
    "Produto Mercado Livre";

  const imagemCatalogo = produtoCatalogo.pictures?.[0];
  const imagemAnuncio = anuncio.pictures?.[0];

  const thumbnail =
    anuncio.secure_thumbnail ??
    anuncio.thumbnail ??
    imagemCatalogo?.secure_url ??
    imagemCatalogo?.url ??
    imagemAnuncio?.secure_url ??
    imagemAnuncio?.url ??
    "";

  const pictures =
    produtoCatalogo.pictures
      ?.map((foto, indice) => {
        const url = foto.url ?? foto.secure_url ?? "";
        const secureUrl = foto.secure_url ?? foto.url ?? "";

        if (!url && !secureUrl) {
          return null;
        }

        return {
          id: foto.id ?? String(indice + 1),
          url,
          secure_url: secureUrl,
        };
      })
      .filter(
        (
          foto
        ): foto is {
          id: string;
          url: string;
          secure_url: string;
        } => foto !== null
      ) ?? [];

  if (typeof anuncio.price !== "number") {
    throw new Error(
      "O Mercado Livre não retornou um preço válido para esse anúncio."
    );
  }

  return {
    id: idAnuncio,
    title: titulo,
    price: anuncio.price,
    original_price: anuncio.original_price ?? null,
    currency_id: anuncio.currency_id ?? "BRL",
    category_id:
      anuncio.category_id ??
      produtoCatalogo.category_id ??
      produtoCatalogo.domain_id ??
      "",
    seller_id: Number(anuncio.seller_id ?? 0),
    permalink:
      anuncio.permalink ??
      `https://produto.mercadolivre.com.br/${idAnuncio}`,
    thumbnail,
    pictures,
    shipping: {
      free_shipping: Boolean(anuncio.shipping?.free_shipping),
    },
  };
}