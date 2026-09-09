import {
  buscarItensDoCatalogoMercadoLivre,
  buscarItensMercadoLivrePorTexto,
  buscarProdutoCatalogoMercadoLivre,
  type ItemCatalogoMercadoLivre,
  type ProdutoCatalogoMercadoLivre,
  type ProdutoMercadoLivre,
} from "@/lib/mercadolivre/api";
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

type ProdutoBuscaComDetalhes = ProdutoMercadoLivre & {
  sold_quantity?: number;
};

type ReferenciasMercadoLivre = {
  productId: string | null;
  itemId: string | null;
  userProductId: string | null;
  termoUrl: string;
};

function normalizarIdMercadoLivre(id: string): string {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "");
}

function normalizarTexto(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairTermoDaUrl(link: string): string {
  try {
    const url = new URL(link);
    const partes = url.pathname
      .split("/")
      .map((parte) => parte.trim())
      .filter(Boolean);

    const indiceMarcador = partes.findIndex((parte) =>
      /^(p|up)$/i.test(parte)
    );

    let slug = "";

    if (indiceMarcador > 0) {
      slug = partes[indiceMarcador - 1];
    } else {
      slug =
        partes.find(
          (parte) =>
            !/^MLB-?\d+/i.test(parte) &&
            !/^MLBU-?\d+/i.test(parte) &&
            !/^_JM$/i.test(parte)
        ) || "";
    }

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
    // Mantem a URL original quando houver codificacao incompleta.
  }

  const productId =
    texto.match(/\/p\/(MLB-?\d+)(?:[/?#]|$)/i)?.[1] || null;

  const userProductId =
    texto.match(/\/up\/(MLBU-?\d+)(?:[/?#]|$)/i)?.[1] || null;

  const itemId =
    texto.match(/[?&#]wid=(MLB-?\d+)/i)?.[1] ||
    texto.match(/(?:^|[?&#])item_id=(MLB-?\d+)/i)?.[1] ||
    texto.match(/item_id(?::|%3A)(MLB-?\d+)/i)?.[1] ||
    texto.match(/produto\.mercadolivre\.com\.br\/(MLB-?\d+)/i)?.[1] ||
    null;

  return {
    productId: productId ? normalizarIdMercadoLivre(productId) : null,
    itemId: itemId ? normalizarIdMercadoLivre(itemId) : null,
    userProductId: userProductId
      ? normalizarIdMercadoLivre(userProductId)
      : null,
    termoUrl: extrairTermoDaUrl(link),
  };
}

function normalizarPrecoApi(valor: unknown): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return String(numero);
}

function imagensDoCatalogo(
  produto: ProdutoCatalogoMercadoLivre | null | undefined
): string[] {
  return Array.from(
    new Set(
      (produto?.pictures || [])
        .map((imagem) => imagem.secure_url || imagem.url || "")
        .map((url) => String(url).trim())
        .filter((url) => url.startsWith("http"))
    )
  );
}

function imagensDaBusca(produto: ProdutoMercadoLivre | null | undefined): string[] {
  const imagens = [
    ...(produto?.pictures || []).map(
      (imagem) => imagem.secure_url || imagem.url || ""
    ),
    produto?.thumbnail || "",
  ]
    .map((url) => String(url).trim())
    .filter((url) => url.startsWith("http"));

  return Array.from(new Set(imagens));
}

function montarProdutoDaBusca(
  produto: ProdutoBuscaComDetalhes,
  linkOriginal: string
) {
  const precoAtual = normalizarPrecoApi(produto.price);
  let precoAntigo = normalizarPrecoApi(produto.original_price);

  if (
    precoAntigo &&
    precoAtual &&
    Number(precoAntigo) <= Number(precoAtual)
  ) {
    precoAntigo = "";
  }

  const imagensGaleria = imagensDaBusca(produto);

  return {
    nome: String(produto.title || "").trim(),
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo,
    precoAtual,
    parcelas: "",
    freteGratis: Boolean(produto.shipping?.free_shipping),
    imagem: imagensGaleria[0] || "",
    imagensGaleria,
    avaliacao: null,
    vendas:
      typeof produto.sold_quantity === "number" && produto.sold_quantity > 0
        ? `${produto.sold_quantity} vendidos`
        : "",
    urlFinal: produto.permalink || linkOriginal,
  };
}

function pontuarResultadoBusca(
  produto: ProdutoMercadoLivre,
  termo: string,
  itemIdAlvo: string | null
): number {
  const id = normalizarIdMercadoLivre(produto.id);

  if (itemIdAlvo && id === itemIdAlvo) {
    return 10000;
  }

  const titulo = normalizarTexto(produto.title || "");
  const consulta = normalizarTexto(termo);

  if (!titulo || !consulta) return 0;
  if (titulo === consulta) return 1000;
  if (titulo.includes(consulta) || consulta.includes(titulo)) return 700;

  const tokensConsulta = new Set(consulta.split(" ").filter(Boolean));
  const tokensTitulo = new Set(titulo.split(" ").filter(Boolean));

  let comuns = 0;
  for (const token of tokensConsulta) {
    if (tokensTitulo.has(token)) comuns += 1;
  }

  return tokensConsulta.size > 0
    ? (comuns / tokensConsulta.size) * 500
    : 0;
}

async function buscarMelhorResultadoMarketplace(
  termo: string,
  itemIdAlvo: string | null
): Promise<ProdutoBuscaComDetalhes | null> {
  const consulta = String(termo || "").trim();
  if (!consulta) return null;

  const resultados = await buscarItensMercadoLivrePorTexto(consulta, 30);

  const validos = resultados.filter(
    (produto) =>
      Boolean(produto?.title) &&
      Number.isFinite(Number(produto?.price)) &&
      Number(produto.price) > 0
  );

  validos.sort(
    (a, b) =>
      pontuarResultadoBusca(b, consulta, itemIdAlvo) -
      pontuarResultadoBusca(a, consulta, itemIdAlvo)
  );

  return (validos[0] as ProdutoBuscaComDetalhes | undefined) || null;
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

function montarProdutoDoCatalogo(
  produto: ProdutoCatalogoComDetalhes,
  produtoBase: ProdutoCatalogoComDetalhes,
  linkOriginal: string
) {
  const vencedor = produto.buy_box_winner;
  const nome = String(produto.name || produtoBase.name || "").trim();
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
    new Set([
      ...imagensDoCatalogo(produto),
      ...imagensDoCatalogo(produtoBase),
    ])
  );

  const quantidadeVendida =
    typeof vencedor?.sold_quantity === "number"
      ? vencedor.sold_quantity
      : typeof produto.sold_quantity === "number"
        ? produto.sold_quantity
        : 0;

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
    urlFinal: produto.permalink || produtoBase.permalink || linkOriginal,
  };
}

function escolherItemCatalogo(
  itens: ItemCatalogoMercadoLivre[],
  itemIdAlvo: string | null
): ItemCatalogoMercadoLivre | null {
  const validos = itens.filter(
    (item) =>
      Number.isFinite(Number(item.price)) && Number(item.price) > 0
  );

  if (itemIdAlvo) {
    const exato = validos.find(
      (item) => normalizarIdMercadoLivre(item.item_id) === itemIdAlvo
    );

    if (exato) return exato;
  }

  return validos[0] || null;
}

async function extrairMercadoLivreCatalogo(
  link: string,
  productId: string,
  itemIdAlvo: string | null,
  termoUrl: string
) {
  const produtoBase = (await buscarProdutoCatalogoMercadoLivre(
    productId
  )) as ProdutoCatalogoComDetalhes;

  if (possuiOfertaVencedora(produtoBase)) {
    const itemVencedor = normalizarIdMercadoLivre(
      produtoBase.buy_box_winner?.item_id || ""
    );

    if (!itemIdAlvo || !itemVencedor || itemVencedor === itemIdAlvo) {
      return montarProdutoDoCatalogo(produtoBase, produtoBase, link);
    }
  }

  const candidatosCatalogo = [produtoBase];

  for (const childId of produtoBase.children_ids || []) {
    try {
      const filho = (await buscarProdutoCatalogoMercadoLivre(
        childId
      )) as ProdutoCatalogoComDetalhes;
      candidatosCatalogo.push(filho);
    } catch {
      // Ignora variacao indisponivel e continua procurando.
    }
  }

  if (itemIdAlvo) {
    const exato = candidatosCatalogo.find(
      (produto) =>
        possuiOfertaVencedora(produto) &&
        normalizarIdMercadoLivre(produto.buy_box_winner?.item_id || "") ===
          itemIdAlvo
    );

    if (exato) {
      return montarProdutoDoCatalogo(exato, produtoBase, link);
    }
  }

  const primeiroComOferta = candidatosCatalogo.find(possuiOfertaVencedora);
  if (primeiroComOferta) {
    return montarProdutoDoCatalogo(primeiroComOferta, produtoBase, link);
  }

  try {
    const listaItens = await buscarItensDoCatalogoMercadoLivre(productId);
    const itemCatalogo = escolherItemCatalogo(
      listaItens.results || [],
      itemIdAlvo
    );

    if (itemCatalogo) {
      const termoBusca = String(produtoBase.name || termoUrl || "").trim();
      const resultadoBusca = await buscarMelhorResultadoMarketplace(
        termoBusca,
        normalizarIdMercadoLivre(itemCatalogo.item_id)
      );

      if (resultadoBusca) {
        return montarProdutoDaBusca(resultadoBusca, link);
      }

      const imagensGaleria = imagensDoCatalogo(produtoBase);
      const precoAtual = normalizarPrecoApi(itemCatalogo.price);
      let precoAntigo = normalizarPrecoApi(itemCatalogo.original_price);

      if (
        precoAntigo &&
        precoAtual &&
        Number(precoAntigo) <= Number(precoAtual)
      ) {
        precoAntigo = "";
      }

      return {
        nome: String(produtoBase.name || termoUrl || "Produto Mercado Livre").trim(),
        categoria: "",
        loja: "Mercado Livre",
        precoAntigo,
        precoAtual,
        parcelas: "",
        freteGratis: false,
        imagem: imagensGaleria[0] || "",
        imagensGaleria,
        avaliacao: null,
        vendas: "",
        urlFinal: produtoBase.permalink || link,
      };
    }
  } catch {
    // O endpoint de competicao pode nao estar disponivel para todos os catalogos.
  }

  const termoBusca = String(produtoBase.name || termoUrl || "").trim();
  const resultadoBusca = await buscarMelhorResultadoMarketplace(
    termoBusca,
    itemIdAlvo
  );

  if (resultadoBusca) {
    return montarProdutoDaBusca(resultadoBusca, link);
  }

  throw new Error(
    `O Mercado Livre encontrou o catalogo ${productId}, mas nao retornou uma oferta ativa para esse produto.`
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

async function extrairMercadoLivreSemPlaywright(link: string) {
  const linkExpandido = await expandirLinkCurtoMercadoLivre(link);
  const referencias = extrairReferenciasMercadoLivre(linkExpandido);

  if (referencias.productId) {
    return extrairMercadoLivreCatalogo(
      linkExpandido,
      referencias.productId,
      referencias.itemId,
      referencias.termoUrl
    );
  }

  const termoBusca = referencias.termoUrl;

  if (termoBusca) {
    const resultadoBusca = await buscarMelhorResultadoMarketplace(
      termoBusca,
      referencias.itemId
    );

    if (resultadoBusca) {
      return montarProdutoDaBusca(resultadoBusca, linkExpandido);
    }
  }

  const identificador =
    referencias.userProductId || referencias.itemId || "link informado";

  throw new Error(
    `Nao foi possivel localizar ${identificador} na busca publica do Mercado Livre. Tente copiar o link completo da pagina do produto.`
  );
}

export async function extrairProduto(link: string) {
  const linkNormalizado = link.toLowerCase();

  if (
    linkNormalizado.includes("mercadolivre") ||
    linkNormalizado.includes("mercadolibre") ||
    linkNormalizado.includes("meli.la")
  ) {
    return extrairMercadoLivreSemPlaywright(link);
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
