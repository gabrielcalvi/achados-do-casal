import {
  buscarProdutoCatalogoMercadoLivre,
  type ProdutoCatalogoMercadoLivre,
} from "@/lib/mercadolivre/api";
import { extrairMercadoLivreWorker } from "@/lib/workers/playwrightWorker";
import { extrairAmazonWorker } from "@/lib/workers/amazonWorker";
import { extrairMagaluWorker } from "@/lib/workers/magaluWorker";
import { extrairCeaWorker } from "@/lib/workers/ceaWorker";
import { extrairKabumWorker } from "@/lib/workers/kabumWorker";

type VencedorCatalogoMercadoLivre = {
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
};

type ProdutoCatalogoComDetalhes = ProdutoCatalogoMercadoLivre & {
  sold_quantity?: number;
  buy_box_winner?: VencedorCatalogoMercadoLivre | null;
};

type ReferenciasMercadoLivre = {
  productId: string | null;
  itemId: string | null;
};

function normalizarIdMercadoLivre(id: string): string {
  return id.toUpperCase().replace(/-/g, "");
}

function extrairReferenciasMercadoLivre(link: string): ReferenciasMercadoLivre {
  let texto = link;

  try {
    texto = decodeURIComponent(link);
  } catch {
    // Mantem a URL original quando houver codificacao incompleta.
  }

  const productId = texto.match(/\/p\/(MLB-?\d+)(?:[/?#]|$)/i)?.[1] || null;

  const itemId =
    texto.match(/[?&#]wid=(MLB-?\d+)/i)?.[1] ||
    texto.match(/(?:^|[?&#])item_id=(MLB-?\d+)/i)?.[1] ||
    texto.match(/item_id(?::|%3A)(MLB-?\d+)/i)?.[1] ||
    null;

  return {
    productId: productId ? normalizarIdMercadoLivre(productId) : null,
    itemId: itemId ? normalizarIdMercadoLivre(itemId) : null,
  };
}

function normalizarPrecoApi(valor: unknown): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return String(numero);
}

function possuiOfertaVencedora(
  produto: ProdutoCatalogoComDetalhes | null | undefined
): produto is ProdutoCatalogoComDetalhes {
  return Boolean(
    produto?.buy_box_winner &&
      Number.isFinite(Number(produto.buy_box_winner.price)) &&
      Number(produto.buy_box_winner.price) > 0
  );
}

async function buscarProdutosCatalogoEmLotes(ids: string[]) {
  const produtos: ProdutoCatalogoComDetalhes[] = [];
  const tamanhoLote = 10;

  for (let inicio = 0; inicio < ids.length; inicio += tamanhoLote) {
    const lote = ids.slice(inicio, inicio + tamanhoLote);
    const resultados = await Promise.allSettled(
      lote.map((id) => buscarProdutoCatalogoMercadoLivre(id))
    );

    for (const resultado of resultados) {
      if (resultado.status === "fulfilled") {
        produtos.push(resultado.value as ProdutoCatalogoComDetalhes);
      }
    }
  }

  return produtos;
}

async function resolverProdutoCatalogoComOferta(
  productId: string,
  itemIdAlvo: string | null
) {
  const produtoInicial = (await buscarProdutoCatalogoMercadoLivre(
    productId
  )) as ProdutoCatalogoComDetalhes;

  if (
    possuiOfertaVencedora(produtoInicial) &&
    (!itemIdAlvo ||
      normalizarIdMercadoLivre(produtoInicial.buy_box_winner?.item_id || "") ===
        itemIdAlvo)
  ) {
    return {
      produtoSelecionado: produtoInicial,
      produtoBase: produtoInicial,
    };
  }

  let produtoBase = produtoInicial;
  let idsFilhos = produtoInicial.children_ids || [];

  if (idsFilhos.length === 0 && produtoInicial.parent_id) {
    try {
      const produtoPai = (await buscarProdutoCatalogoMercadoLivre(
        produtoInicial.parent_id
      )) as ProdutoCatalogoComDetalhes;

      produtoBase = produtoPai;
      idsFilhos = produtoPai.children_ids || [];

      if (
        possuiOfertaVencedora(produtoPai) &&
        (!itemIdAlvo ||
          normalizarIdMercadoLivre(produtoPai.buy_box_winner?.item_id || "") ===
            itemIdAlvo)
      ) {
        return {
          produtoSelecionado: produtoPai,
          produtoBase: produtoPai,
        };
      }
    } catch {
      // Se o pai nao puder ser consultado, continua com o produto inicial.
    }
  }

  const idsUnicos = Array.from(
    new Set(idsFilhos.map((id) => normalizarIdMercadoLivre(id)).filter(Boolean))
  );

  const produtosFilhos = await buscarProdutosCatalogoEmLotes(idsUnicos);

  if (itemIdAlvo) {
    const filhoDoLink = produtosFilhos.find((produto) => {
      const itemId = produto.buy_box_winner?.item_id;
      return itemId && normalizarIdMercadoLivre(itemId) === itemIdAlvo;
    });

    if (possuiOfertaVencedora(filhoDoLink)) {
      return {
        produtoSelecionado: filhoDoLink,
        produtoBase,
      };
    }
  }

  const primeiroFilhoComOferta = produtosFilhos.find(possuiOfertaVencedora);

  if (primeiroFilhoComOferta) {
    return {
      produtoSelecionado: primeiroFilhoComOferta,
      produtoBase,
    };
  }

  if (possuiOfertaVencedora(produtoInicial)) {
    return {
      produtoSelecionado: produtoInicial,
      produtoBase,
    };
  }

  throw new Error(
    `O catalogo ${productId} foi encontrado, mas nenhuma variacao ativa com preco esta disponivel.`
  );
}

async function extrairMercadoLivreCatalogo(
  link: string,
  productId: string,
  itemIdAlvo: string | null
) {
  const { produtoSelecionado, produtoBase } =
    await resolverProdutoCatalogoComOferta(productId, itemIdAlvo);

  const vencedor = produtoSelecionado.buy_box_winner;

  const nome = String(
    produtoSelecionado.name || produtoBase.name || ""
  ).trim();
  const precoAtual = normalizarPrecoApi(vencedor?.price);

  let precoAntigo = normalizarPrecoApi(vencedor?.original_price);

  if (
    precoAntigo &&
    precoAtual &&
    Number(precoAntigo) <= Number(precoAtual)
  ) {
    precoAntigo = "";
  }

  const imagensGaleria = Array.from(
    new Set(
      [...(produtoSelecionado.pictures || []), ...(produtoBase.pictures || [])]
        .map((imagem) => imagem.secure_url || imagem.url || "")
        .map((url) => String(url).trim())
        .filter((url) => url.startsWith("http"))
    )
  );

  const quantidadeVendida =
    typeof vencedor?.sold_quantity === "number"
      ? vencedor.sold_quantity
      : typeof produtoSelecionado.sold_quantity === "number"
        ? produtoSelecionado.sold_quantity
        : 0;

  if (!nome) {
    throw new Error(
      `Nome do produto de catalogo ${produtoSelecionado.id} nao encontrado no Mercado Livre.`
    );
  }

  if (!precoAtual) {
    throw new Error(
      `Preco da variacao ${produtoSelecionado.id} nao encontrado no Mercado Livre.`
    );
  }

  return {
    nome,
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas: "",
    freteGratis: Boolean(vencedor?.shipping?.free_shipping),
    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    avaliacao: null,
    vendas: quantidadeVendida > 0 ? `${quantidadeVendida} vendidos` : "",
    urlFinal: produtoSelecionado.permalink || produtoBase.permalink || link,
  };
}

export async function extrairProduto(link: string) {
  const linkNormalizado = link.toLowerCase();

  if (
    linkNormalizado.includes("mercadolivre") ||
    linkNormalizado.includes("mercadolibre") ||
    linkNormalizado.includes("meli.la")
  ) {
    const referencias = extrairReferenciasMercadoLivre(link);

    if (referencias.productId) {
      return extrairMercadoLivreCatalogo(
        link,
        referencias.productId,
        referencias.itemId
      );
    }

    return extrairMercadoLivreWorker(link);
  }

  if (
    linkNormalizado.includes("amazon.com.br") ||
    linkNormalizado.includes("amzn.to")
  ) {
    return extrairAmazonWorker(link);
  }

  if (
    linkNormalizado.includes("magazineluiza.com.br") ||
    linkNormalizado.includes("magalu") ||
    linkNormalizado.includes("magazinevoce.com.br")
  ) {
    return extrairMagaluWorker(link);
  }

  if (
    linkNormalizado.includes("cea.com.br") ||
    linkNormalizado.includes("awinmid=17648") ||
    (
      linkNormalizado.includes("awin1.com") &&
      linkNormalizado.includes("cea.com.br")
    )
  ) {
    return extrairCeaWorker(link);
  }

  if (
    linkNormalizado.includes("kabum.com.br") ||
    linkNormalizado.includes("awinmid=17729")
  ) {
    return extrairKabumWorker(link);
  }

  throw new Error("Loja ainda nao suportada.");
}
