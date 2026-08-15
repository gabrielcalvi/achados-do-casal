import {
  buscarItemIdDoCatalogo,
  buscarProdutoMercadoLivre,
} from "@/lib/mercadolivre/api";
import { resolverItemId } from "@/lib/resolvers/mercadoLivre";
import { WORKER_URL } from "@/lib/workers/workerUrl";

export type ProdutoExtraidoWorker = {
  nome: string;
  categoria: string;
  loja: string;
  precoAntigo: string;
  precoAtual: string;
  parcelas?: string;
  freteGratis?: boolean;
  avaliacao?: number;
  vendas?: string;
  imagem: string;
  imagensGaleria?: string[];
  urlFinal: string;
};

async function extrairMercadoLivreViaApi(
  link: string
): Promise<ProdutoExtraidoWorker | null> {
  try {
    const referencia = await resolverItemId(link);

    if (!referencia) {
      return null;
    }

    const itemId =
      referencia.tipo === "produto"
        ? await buscarItemIdDoCatalogo(referencia.id)
        : referencia.id;

    const produto = await buscarProdutoMercadoLivre(itemId);

    const imagensGaleria = (produto.pictures || [])
      .map((imagem) => imagem.secure_url || imagem.url)
      .filter(Boolean);

    const imagem =
      imagensGaleria[0] ||
      produto.thumbnail ||
      "";

    if (!produto.title || !Number.isFinite(Number(produto.price))) {
      return null;
    }

    return {
      nome: produto.title,
      categoria: produto.category_id || "",
      loja: "Mercado Livre",
      precoAntigo:
        produto.original_price &&
        Number(produto.original_price) > Number(produto.price)
          ? String(produto.original_price)
          : "",
      precoAtual: String(produto.price),
      parcelas: "",
      freteGratis: Boolean(produto.shipping?.free_shipping),
      avaliacao: undefined,
      vendas: "",
      imagem,
      imagensGaleria,
      urlFinal: produto.permalink || link,
    };
  } catch (erro) {
    console.warn(
      "[Mercado Livre API] Falha; usando Playwright como fallback:",
      erro instanceof Error ? erro.message : erro
    );

    return null;
  }
}

async function extrairMercadoLivreViaWorker(
  link: string
): Promise<ProdutoExtraidoWorker> {
  let resposta: Response;

  try {
    resposta = await fetch(
      `${WORKER_URL}/extrair?url=${encodeURIComponent(link)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(300000),
      }
    );
  } catch (erro) {
    const detalhe =
      erro instanceof Error ? erro.message : "falha de conexão";

    throw new Error(
      `O Playwright Worker não está acessível em ${WORKER_URL}. ` +
        `Detalhe: ${detalhe}`
    );
  }

  let json: {
    sucesso?: boolean;
    dados?: ProdutoExtraidoWorker;
    erro?: string;
  };

  try {
    json = await resposta.json();
  } catch {
    throw new Error(
      `O Playwright Worker respondeu em formato inválido (${resposta.status}).`
    );
  }

  if (!resposta.ok || !json.sucesso || !json.dados) {
    throw new Error(
      json.erro || `Playwright Worker respondeu ${resposta.status}.`
    );
  }

  return json.dados;
}

export async function extrairMercadoLivreWorker(
  link: string
): Promise<ProdutoExtraidoWorker> {
  const viaApi = await extrairMercadoLivreViaApi(link);

  if (viaApi) {
    return viaApi;
  }

  return extrairMercadoLivreViaWorker(link);
}
