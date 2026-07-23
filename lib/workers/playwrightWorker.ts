const WORKER_URL = (
  process.env.PLAYWRIGHT_WORKER_URL ||
  "http://127.0.0.1:4317"
).replace(/\/$/, "");

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

export async function extrairMercadoLivreWorker(
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
        `Inicie-o com \"npm run playwright\". Detalhe: ${detalhe}`
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
