import {
  buscarItensDoCatalogoMercadoLivre,
  buscarItensDoUserProductMercadoLivre,
  buscarProdutoCatalogoMercadoLivre,
  buscarProdutosCatalogoMercadoLivre,
  type ItemCatalogoMercadoLivre,
  type ProdutoCatalogoMercadoLivre,
} from "@/lib/mercadolivre/api";
import { extrairAmazonWorker } from "@/lib/workers/amazonWorker";
import { extrairMagaluWorker } from "@/lib/workers/magaluWorker";
import { extrairCeaWorker } from "@/lib/workers/ceaWorker";
import { extrairKabumWorker } from "@/lib/workers/kabumWorker";

type ReferenciasMercadoLivre = {
  productId: string | null;
  itemId: string | null;
  userProductId: string | null;
  termoUrl: string;
};

function normalizarId(valor: string): string {
  return String(valor || "").trim().toUpperCase().replace(/-/g, "");
}

function extrairTermoDaUrl(link: string): string {
  try {
    const url = new URL(link);
    const partes = url.pathname
      .split("/")
      .map((parte) => parte.trim())
      .filter(Boolean);

    const indiceMarcador = partes.findIndex((parte) => /^(p|up)$/i.test(parte));
    const slug = indiceMarcador > 0 ? partes[indiceMarcador - 1] : partes[0] || "";

    return decodeURIComponent(slug)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function extrairReferenciasMercadoLivre(link: string): ReferenciasMercadoLivre {
  let texto = link;

  try {
    texto = decodeURIComponent(link);
  } catch {
    // Mantem o texto original quando a URL possui codificacao incompleta.
  }

  const productId = texto.match(/\/p\/(MLB-?\d+)(?:[/?#]|$)/i)?.[1] || null;
  const userProductId = texto.match(/\/up\/(MLBU-?\d+)(?:[/?#]|$)/i)?.[1] || null;

  const itemId =
    texto.match(/[?&#]wid=(MLB-?\d+)/i)?.[1] ||
    texto.match(/(?:^|[?&#])item_id=(MLB-?\d+)/i)?.[1] ||
    texto.match(/item_id(?::|%3A)(MLB-?\d+)/i)?.[1] ||
    texto.match(/produto\.mercadolivre\.com\.br\/(MLB-?\d+)/i)?.[1] ||
    null;

  return {
    productId: productId ? normalizarId(productId) : null,
    itemId: itemId ? normalizarId(itemId) : null,
    userProductId: userProductId ? normalizarId(userProductId) : null,
    termoUrl: extrairTermoDaUrl(link),
  };
}

function normalizarPreco(valor: unknown): string {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : "";
}

function imagensDoCatalogo(produto: ProdutoCatalogoMercadoLivre): string[] {
  return Array.from(
    new Set(
      (produto.pictures || [])
        .map((imagem) => imagem.secure_url || imagem.url || "")
        .map((url) => String(url).trim())
        .filter((url) => /^https?:\/\//i.test(url))
    )
  );
}

function itemTemPreco(item: ItemCatalogoMercadoLivre | null | undefined): item is ItemCatalogoMercadoLivre {
  return Boolean(item && Number.isFinite(Number(item.price)) && Number(item.price) > 0);
}

function escolherItem(
  itens: ItemCatalogoMercadoLivre[],
  itemId: string | null,
  userProductId: string | null,
  buyBoxItemId?: string | null
): ItemCatalogoMercadoLivre | null {
  const validos = itens.filter(itemTemPreco);

  if (itemId) {
    const exato = validos.find((item) => normalizarId(item.item_id) === itemId);
    if (exato) return exato;
  }

  if (userProductId) {
    const exato = validos.find(
      (item) => normalizarId(item.user_product_id || "") === userProductId
    );
    if (exato) return exato;
  }

  if (buyBoxItemId) {
    const exato = validos.find(
      (item) => normalizarId(item.item_id) === normalizarId(buyBoxItemId)
    );
    if (exato) return exato;
  }

  return validos[0] || null;
}

function montarProdutoMercadoLivre(
  produto: ProdutoCatalogoMercadoLivre,
  item: ItemCatalogoMercadoLivre,
  linkOriginal: string
) {
  const precoAtual = normalizarPreco(item.price);
  let precoAntigo = normalizarPreco(item.original_price);

  if (precoAntigo && Number(precoAntigo) <= Number(precoAtual)) {
    precoAntigo = "";
  }

  const imagensGaleria = imagensDoCatalogo(produto);

  return {
    nome: String(produto.name || "Produto Mercado Livre").trim(),
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas: "",
    freteGratis: Boolean(item.shipping?.free_shipping),
    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    avaliacao: null,
    vendas: "",
    urlFinal: linkOriginal,
  };
}

function montarProdutoUserProduct(
  item: ItemCatalogoMercadoLivre,
  termoUrl: string,
  linkOriginal: string,
  imagensGaleria: string[] = []
) {
  const precoAtual = normalizarPreco(item.price);
  let precoAntigo = normalizarPreco(item.original_price);

  if (precoAntigo && Number(precoAntigo) <= Number(precoAtual)) {
    precoAntigo = "";
  }

  const nome = termoUrl
    .replace(/\bpa\s+enxada\b/i, "Pá Enxada")
    .replace(/\s+/g, " ")
    .trim();

  return {
    nome: nome || "Produto Mercado Livre",
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas: "",
    freteGratis: Boolean(item.shipping?.free_shipping),
    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    avaliacao: null,
    vendas: "",
    urlFinal: linkOriginal,
  };
}

async function extrairPorCatalogo(
  link: string,
  productId: string,
  itemId: string | null,
  userProductId: string | null
) {
  const [produto, lista] = await Promise.all([
    buscarProdutoCatalogoMercadoLivre(productId),
    buscarItensDoCatalogoMercadoLivre(productId),
  ]);

  const item = escolherItem(
    lista.results || [],
    itemId,
    userProductId,
    produto.buy_box_winner?.item_id || null
  );

  if (!item) {
    throw new Error(`O catálogo ${productId} não possui uma oferta ativa com preço.`);
  }

  return montarProdutoMercadoLivre(produto, item, link);
}

function normalizarTextoComparacao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\banti\s+faiscante\b/g, "antifaiscante")
    .replace(/\b(pvc|plastica|plastico)\b/g, "plastico")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS_COMPARACAO = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "para",
  "por",
  "em",
  "e",
]);

function tokensComparacao(texto: string): string[] {
  return normalizarTextoComparacao(texto)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS_COMPARACAO.has(token));
}

function pontuarCatalogo(produto: ProdutoCatalogoMercadoLivre, termo: string): number {
  const alvo = normalizarTextoComparacao(termo);
  const nome = normalizarTextoComparacao(String(produto.name || ""));

  if (!alvo || !nome) return 0;
  if (alvo === nome) return 1000;

  const tokens = tokensComparacao(alvo);
  const tokensNome = new Set(tokensComparacao(nome));
  const comuns = tokens.filter((token) => tokensNome.has(token)).length;

  return tokens.length ? (comuns / tokens.length) * 100 : 0;
}

function pontuarImagemCatalogo(produto: ProdutoCatalogoMercadoLivre, termo: string): number {
  const alvo = Array.from(new Set(tokensComparacao(termo)));
  const nome = new Set(tokensComparacao(String(produto.name || "")));

  if (alvo.length < 4 || nome.size < 4) return 0;

  const comuns = alvo.filter((token) => nome.has(token)).length;
  return (comuns / alvo.length) * 100;
}

async function extrairUserProduct(
  link: string,
  userProductId: string,
  termoUrl: string,
  itemId: string | null
) {
  let itemDireto: ItemCatalogoMercadoLivre | null = null;

  try {
    const listaDireta = await buscarItensDoUserProductMercadoLivre(userProductId);
    itemDireto = escolherItem(
      listaDireta.results || [],
      itemId,
      userProductId,
      null
    );
  } catch {
    // Alguns User Products antigos não possuem winner direto. Nesses casos,
    // continuamos pela busca oficial de catálogo em vez de abortar a extração.
  }

  if (!termoUrl) {
    if (itemDireto) return montarProdutoUserProduct(itemDireto, termoUrl, link);
    throw new Error("Não foi possível identificar o nome do produto no link do Mercado Livre.");
  }

  let candidatos: ProdutoCatalogoMercadoLivre[] = [];

  try {
    candidatos = await buscarProdutosCatalogoMercadoLivre(termoUrl, 20);
  } catch (error) {
    if (itemDireto) return montarProdutoUserProduct(itemDireto, termoUrl, link);
    throw error;
  }

  candidatos.sort((a, b) => pontuarCatalogo(b, termoUrl) - pontuarCatalogo(a, termoUrl));

  let melhorFallback:
    | {
        produto: ProdutoCatalogoMercadoLivre;
        item: ItemCatalogoMercadoLivre;
        pontuacao: number;
      }
    | null = null;

  let melhorCatalogoImagem:
    | {
        produto: ProdutoCatalogoMercadoLivre;
        pontuacao: number;
      }
    | null = null;

  for (const produto of candidatos) {
    const pontuacao = pontuarCatalogo(produto, termoUrl);
    const pontuacaoImagem = pontuarImagemCatalogo(produto, termoUrl);

    if (
      itemDireto &&
      pontuacaoImagem >= 90 &&
      (!melhorCatalogoImagem || pontuacaoImagem > melhorCatalogoImagem.pontuacao)
    ) {
      melhorCatalogoImagem = { produto, pontuacao: pontuacaoImagem };
    }

    try {
      const lista = await buscarItensDoCatalogoMercadoLivre(produto.id);
      const itens = lista.results || [];

      const exato = itens.find((item) => {
        if (!itemTemPreco(item)) return false;
        if (itemId && normalizarId(item.item_id) === itemId) return true;
        return normalizarId(item.user_product_id || "") === userProductId;
      });

      if (exato) {
        return montarProdutoMercadoLivre(produto, exato, link);
      }

      if (!itemDireto && pontuacao >= 75) {
        const itemFallback = escolherItem(
          itens,
          null,
          null,
          produto.buy_box_winner?.item_id || null
        );

        if (
          itemFallback &&
          (!melhorFallback || pontuacao > melhorFallback.pontuacao)
        ) {
          melhorFallback = {
            produto,
            item: itemFallback,
            pontuacao,
          };
        }
      }
    } catch {
      // Continua nos próximos catálogos caso um candidato não possa ser consultado.
    }
  }

  if (itemDireto) {
    let imagensGaleria: string[] = [];

    if (melhorCatalogoImagem) {
      try {
        const detalhe = await buscarProdutoCatalogoMercadoLivre(
          melhorCatalogoImagem.produto.id
        );
        imagensGaleria = imagensDoCatalogo(detalhe);
      } catch {
        // Se o catálogo de imagem falhar, preservamos o produto exato sem imagem.
      }
    }

    return montarProdutoUserProduct(
      itemDireto,
      termoUrl,
      link,
      imagensGaleria
    );
  }

  if (melhorFallback) {
    return montarProdutoMercadoLivre(
      melhorFallback.produto,
      melhorFallback.item,
      link
    );
  }

  throw new Error(
    `O produto ${userProductId} foi reconhecido, mas não foi localizado com confiança entre os catálogos ativos do Mercado Livre.`
  );
}

async function expandirLinkCurtoMercadoLivre(link: string): Promise<string> {
  if (!/meli\.la/i.test(link)) return link;

  try {
    const resposta = await fetch(link, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    return resposta.url || link;
  } catch {
    return link;
  }
}

async function extrairMercadoLivre(link: string) {
  const linkExpandido = await expandirLinkCurtoMercadoLivre(link);
  const referencias = extrairReferenciasMercadoLivre(linkExpandido);

  if (referencias.productId) {
    return extrairPorCatalogo(
      link,
      referencias.productId,
      referencias.itemId,
      referencias.userProductId
    );
  }

  if (referencias.userProductId) {
    return extrairUserProduct(
      link,
      referencias.userProductId,
      referencias.termoUrl,
      referencias.itemId
    );
  }

  throw new Error(
    "Não foi possível identificar o catálogo ou User Product do Mercado Livre nesse link."
  );
}

export async function extrairProduto(link: string) {
  const linkNormalizado = link.toLowerCase();

  if (
    linkNormalizado.includes("mercadolivre") ||
    linkNormalizado.includes("mercadolibre") ||
    linkNormalizado.includes("meli.la")
  ) {
    return extrairMercadoLivre(link);
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
    (linkNormalizado.includes("awin1.com") && linkNormalizado.includes("cea.com.br"))
  ) {
    return extrairCeaWorker(link);
  }

  if (
    linkNormalizado.includes("kabum.com.br") ||
    linkNormalizado.includes("awinmid=17729")
  ) {
    return extrairKabumWorker(link);
  }

  throw new Error("Loja ainda não suportada.");
}
