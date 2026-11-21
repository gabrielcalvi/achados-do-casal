import {
  buscarItensDoCatalogoMercadoLivre,
  buscarItensDoUserProductMercadoLivre,
  buscarProdutoMercadoLivre,
  buscarProdutoCatalogoMercadoLivre,
  buscarProdutosCatalogoMercadoLivre,
  type ItemCatalogoMercadoLivre,
  type ProdutoCatalogoMercadoLivre,
} from "@/lib/mercadolivre/api";
import { extrairAmazonWorker } from "@/lib/workers/amazonWorker";
import { extrairMagaluWorker } from "@/lib/workers/magaluWorker";
import { extrairCeaWorker } from "@/lib/workers/ceaWorker";
import { extrairKabumWorker } from "@/lib/workers/kabumWorker";
import { consultarListaMercadoLivre } from "@/lib/services/mercadoLivreHttpMonitor";

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
    let slug = indiceMarcador > 0 ? partes[indiceMarcador - 1] : partes[0] || "";

    // Links diretos usam /MLB-1234567890-nome-do-produto-_JM.
    // Removemos o ITEM_ID e o sufixo técnico para obter apenas o nome.
    slug = slug
      .replace(/^MLB-?\d+-/i, "")
      .replace(/-_JM$/i, "");

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

function montarProdutoItemDiretoMercadoLivre(
  item: {
    title?: string;
    price?: number;
    original_price?: number | null;
    thumbnail?: string;
    pictures?: Array<{ url?: string; secure_url?: string }>;
    shipping?: { free_shipping?: boolean };
  },
  linkOriginal: string
) {
  const precoAtual = normalizarPreco(item.price);
  let precoAntigo = normalizarPreco(item.original_price);

  if (precoAntigo && Number(precoAntigo) <= Number(precoAtual)) {
    precoAntigo = "";
  }

  const imagensGaleria = Array.from(
    new Set(
      [
        ...(item.pictures || []).map(
          (imagem) => imagem.secure_url || imagem.url || ""
        ),
        item.thumbnail || "",
      ]
        .map((url) => String(url).trim())
        .filter((url) => /^https?:\/\//i.test(url))
    )
  );

  return {
    nome: String(item.title || "Produto Mercado Livre").trim(),
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

async function extrairPorItemDireto(
  link: string,
  itemId: string,
  termoUrl: string
) {
  try {
    const item = await buscarProdutoMercadoLivre(itemId);

    if (Number.isFinite(Number(item.price)) && Number(item.price) > 0) {
      return montarProdutoItemDiretoMercadoLivre(item, link);
    }
  } catch {
    // Alguns anúncios de terceiros devolvem 403 no endpoint /items/{id}.
    // Nesses casos tentamos localizar o ITEM_ID dentro do catálogo oficial.
  }

  if (!termoUrl) {
    throw new Error(
      `O anúncio ${itemId} foi identificado, mas o Mercado Livre bloqueou a leitura direta e o link não trouxe nome suficiente para localizar o catálogo.`
    );
  }

  const candidatos = await buscarProdutosCatalogoMercadoLivre(termoUrl, 20);
  candidatos.sort((a, b) => pontuarCatalogo(b, termoUrl) - pontuarCatalogo(a, termoUrl));

  let melhorFallback:
    | {
        produto: ProdutoCatalogoMercadoLivre;
        item: ItemCatalogoMercadoLivre;
        pontuacao: number;
      }
    | null = null;

  for (const produto of candidatos) {
    const pontuacao = pontuarCatalogo(produto, termoUrl);

    try {
      const lista = await buscarItensDoCatalogoMercadoLivre(produto.id);
      const itens = lista.results || [];

      const exato = itens.find(
        (item) =>
          itemTemPreco(item) &&
          normalizarId(item.item_id) === normalizarId(itemId)
      );

      if (exato) {
        return montarProdutoMercadoLivre(produto, exato, link);
      }

      if (pontuacao >= 82) {
        const candidatoFallback = escolherItem(
          itens,
          null,
          null,
          produto.buy_box_winner?.item_id || null
        );

        if (
          candidatoFallback &&
          (!melhorFallback || pontuacao > melhorFallback.pontuacao)
        ) {
          melhorFallback = {
            produto,
            item: candidatoFallback,
            pontuacao,
          };
        }
      }
    } catch {
      // Continua tentando os demais catálogos.
    }
  }

  if (melhorFallback) {
    return montarProdutoMercadoLivre(
      melhorFallback.produto,
      melhorFallback.item,
      link
    );
  }

  try {
    const lista = await consultarListaMercadoLivre();
    const itemLista = lista.itens.find(
      (item) => normalizarId(item.itemId) === normalizarId(itemId)
    );

    if (itemLista) {
      const precoAtual = normalizarPreco(itemLista.preco);
      let precoAntigo = normalizarPreco(itemLista.precoAntigo);

      if (precoAntigo && Number(precoAntigo) <= Number(precoAtual)) {
        precoAntigo = "";
      }

      const imagem = String(itemLista.imagem || "").trim();
      const nomeLista = String(itemLista.titulo || "").trim();

      return {
        nome:
          nomeLista ||
          termoUrl
            .split(" ")
            .filter(Boolean)
            .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
            .join(" ") ||
          `Produto Mercado Livre ${itemId}`,
        categoria: "",
        loja: "Mercado Livre",
        precoAntigo,
        precoAtual,
        parcelas: String(itemLista.parcelas || ""),
        freteGratis: false,
        imagem,
        imagensGaleria: imagem ? [imagem] : [],
        avaliacao: null,
        vendas: "",
        urlFinal: link,
        aviso:
          "Anúncio direto bloqueado pelo Mercado Livre; dados recuperados pela lista oficial de favoritos. Confira apenas o link de afiliado antes de salvar.",
      };
    }
  } catch {
    // Se a lista estiver indisponível, preservamos o fallback manual abaixo.
  }

  return {
    nome: termoUrl
      .split(" ")
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(" ") || `Produto Mercado Livre ${itemId}`,
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo: "",
    precoAtual: "",
    parcelas: "",
    freteGratis: false,
    imagem: "",
    imagensGaleria: [],
    avaliacao: null,
    vendas: "",
    urlFinal: link,
    aviso:
      "Link do Mercado Livre reconhecido, mas o anúncio bloqueou a leitura automática e ainda não está na lista oficial. Favorite o produto na lista do ML e clique em preparar novamente para preencher preço, parcelas e imagem.",
  };
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
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\banti\s+faiscante\b/g, "antifaiscante")
    .replace(/\b(pvc|plastica|plastico)\b/g, "plastico")
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

async function enriquecerMercadoLivreComLista(
  produto: Record<string, any>,
  itemId: string | null
) {
  if (!itemId) return produto;

  try {
    const lista = await consultarListaMercadoLivre();
    const itemLista = lista.itens.find(
      (item) => normalizarId(item.itemId) === normalizarId(itemId)
    );

    if (!itemLista) return produto;

    const precoAtualLista = normalizarPreco(itemLista.preco);
    let precoAntigoLista = normalizarPreco(itemLista.precoAntigo);

    if (
      precoAntigoLista &&
      precoAtualLista &&
      Number(precoAntigoLista) <= Number(precoAtualLista)
    ) {
      precoAntigoLista = "";
    }

    const imagemLista = String(itemLista.imagem || "").trim();
    const imagensAtuais = Array.isArray(produto.imagensGaleria)
      ? produto.imagensGaleria.filter(Boolean)
      : [];

    return {
      ...produto,
      precoAtual: precoAtualLista || produto.precoAtual || "",
      precoAntigo: precoAntigoLista || produto.precoAntigo || "",
      parcelas: String(itemLista.parcelas || produto.parcelas || ""),
      imagem: produto.imagem || imagemLista,
      imagensGaleria:
        imagensAtuais.length > 0
          ? imagensAtuais
          : imagemLista
            ? [imagemLista]
            : [],
    };
  } catch {
    return produto;
  }
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

  let produto: Record<string, any>;

  if (referencias.productId) {
    produto = await extrairPorCatalogo(
      link,
      referencias.productId,
      referencias.itemId,
      referencias.userProductId
    );
    return enriquecerMercadoLivreComLista(produto, referencias.itemId);
  }

  if (referencias.userProductId) {
    produto = await extrairUserProduct(
      link,
      referencias.userProductId,
      referencias.termoUrl,
      referencias.itemId
    );
    return enriquecerMercadoLivreComLista(produto, referencias.itemId);
  }

  if (referencias.itemId) {
    produto = await extrairPorItemDireto(
      link,
      referencias.itemId,
      referencias.termoUrl
    );
    return enriquecerMercadoLivreComLista(produto, referencias.itemId);
  }

  throw new Error(
    "Não foi possível identificar o catálogo, User Product ou ITEM_ID do Mercado Livre nesse link."
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
