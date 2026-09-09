import { buscarProdutoCatalogoMercadoLivre } from "@/lib/mercadolivre/api";
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

function extrairProductIdCatalogoMercadoLivre(link: string): string | null {
  let texto = link;

  try {
    texto = decodeURIComponent(link);
  } catch {
    // Mantem a URL original quando houver codificacao incompleta.
  }

  const productId = texto.match(/\/p\/(MLB-?\d+)(?:[/?#]|$)/i)?.[1];

  return productId
    ? productId.toUpperCase().replace(/-/g, "")
    : null;
}

function normalizarPrecoApi(valor: unknown): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return String(numero);
}

async function extrairMercadoLivreCatalogo(link: string, productId: string) {
  const produto = await buscarProdutoCatalogoMercadoLivre(productId);
  const vencedor = produto.buy_box_winner as
    | VencedorCatalogoMercadoLivre
    | null
    | undefined;

  const nome = String(produto.name || "").trim();
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
      (produto.pictures || [])
        .map((imagem) => imagem.secure_url || imagem.url || "")
        .map((url) => String(url).trim())
        .filter((url) => url.startsWith("http"))
    )
  );

  if (!nome) {
    throw new Error(
      `Nome do produto de catalogo ${productId} nao encontrado no Mercado Livre.`
    );
  }

  if (!precoAtual) {
    throw new Error(
      `O produto de catalogo ${productId} nao possui uma oferta vencedora com preco disponivel.`
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
    vendas:
      typeof vencedor?.sold_quantity === "number" && vencedor.sold_quantity > 0
        ? `${vencedor.sold_quantity} vendidos`
        : "",
    urlFinal: produto.permalink || link,
  };
}

export async function extrairProduto(link: string) {
  const linkNormalizado = link.toLowerCase();

  if (
    linkNormalizado.includes("mercadolivre") ||
    linkNormalizado.includes("mercadolibre") ||
    linkNormalizado.includes("meli.la")
  ) {
    const productId = extrairProductIdCatalogoMercadoLivre(link);

    if (productId) {
      return extrairMercadoLivreCatalogo(link, productId);
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
