import { Sandbox } from "@vercel/sandbox";
import type { ProdutoExtraidoWorker } from "@/lib/workers/playwrightWorker";

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const BASE_DIR = "/vercel/monitor-lote";
const SCRIPT_PATH = `${BASE_DIR}/monitor-mercado-livre-lote.cjs`;
const EXTRACTOR_PATH = `${BASE_DIR}/extractors/mercado-livre.cjs`;
const HELPERS_PATH = `${BASE_DIR}/extractors/helpers.cjs`;
const INPUT_PATH = `${BASE_DIR}/entrada.json`;
const OUTPUT_PATH = `${BASE_DIR}/saida.json`;
const REPOSITORY = "gabrielcalvi/achados-do-casal";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

type ProdutoLote = {
  id: number;
  link: string;
};

export type ResultadoMercadoLivreLote = {
  id: number;
  sucesso: boolean;
  dados?: ProdutoExtraidoWorker;
  erro?: string;
};

function extrairItemIdMercadoLivre(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid") || "",
      url.searchParams.get("item_id") || "",
      url.searchParams.get("pdp_filters") || "",
      url.pathname,
      link,
    ];

    for (const candidato of candidatos) {
      const match = candidato.match(/MLB[-:]?(\d{8,})/i);
      if (match?.[1]) return `MLB${match[1]}`;
    }
  } catch {
    const match = link.match(/MLB[-:]?(\d{8,})/i);
    if (match?.[1]) return `MLB${match[1]}`;
  }

  return null;
}

function urlDireta(link: string) {
  const itemId = extrairItemIdMercadoLivre(link);
  if (!itemId) return link;

  return `https://produto.mercadolivre.com.br/MLB-${itemId.replace(/^MLB/i, "")}-_JM`;
}

async function executar(
  sandbox: SandboxInstancia,
  cmd: string,
  args: string[],
  env?: Record<string, string>
) {
  const resultado = await sandbox.runCommand({
    cmd,
    args,
    cwd: "/vercel",
    env,
  });

  return {
    resultado,
    stdout: (await resultado.stdout()).trim(),
    stderr: (await resultado.stderr()).trim(),
  };
}

async function baixar(
  sandbox: SandboxInstancia,
  origem: string,
  destino: string
) {
  const download = await executar(sandbox, "curl", [
    "-fsSL",
    "--max-time",
    "30",
    origem,
    "-o",
    destino,
  ]);

  if (download.resultado.exitCode !== 0) {
    throw new Error(download.stderr || `Falha ao baixar ${destino}.`);
  }
}

async function prepararArquivos(sandbox: SandboxInstancia) {
  const diretorios = await executar(sandbox, "mkdir", [
    "-p",
    `${BASE_DIR}/extractors`,
  ]);

  if (diretorios.resultado.exitCode !== 0) {
    throw new Error(diretorios.stderr || "Falha preparando diretorio do lote ML.");
  }

  const auth = await executar(sandbox, "test", ["-s", AUTH_STATE_PATH]);
  if (auth.resultado.exitCode !== 0) {
    throw new Error(
      "Sessao buyer do Mercado Livre nao encontrada no Sandbox. Renove a sessao ML V2."
    );
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
  const base = `https://raw.githubusercontent.com/${REPOSITORY}/${commit}`;

  await baixar(
    sandbox,
    `${base}/scripts/monitor-mercado-livre-lote.cjs`,
    SCRIPT_PATH
  );
  await baixar(
    sandbox,
    `${base}/scripts/extractors/mercado-livre.cjs`,
    EXTRACTOR_PATH
  );
  await baixar(
    sandbox,
    `${base}/scripts/extractors/helpers.cjs`,
    HELPERS_PATH
  );
}

export async function extrairLoteMercadoLivre(
  produtos: ProdutoLote[]
): Promise<ResultadoMercadoLivreLote[]> {
  const lote = produtos.slice(0, 4);

  if (lote.length === 0) {
    return [];
  }

  const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
  await prepararArquivos(sandbox);

  const entrada = {
    produtos: lote.map((produto) => ({
      id: produto.id,
      url: urlDireta(produto.link),
    })),
  };

  await sandbox.writeFiles([
    {
      path: INPUT_PATH,
      content: Buffer.from(JSON.stringify(entrada), "utf8"),
      mode: 0o600,
    },
  ]);

  await executar(sandbox, "rm", ["-f", OUTPUT_PATH]);

  console.log(
    `[MONITOR ML LOTE] Executando IDs: ${lote.map((produto) => produto.id).join(", ")}`
  );

  const execucao = await executar(
    sandbox,
    "xvfb-run",
    ["-a", "node", SCRIPT_PATH],
    {
      MELI_BUYER_AUTH_STATE_PATH: AUTH_STATE_PATH,
      MONITOR_ML_INPUT: INPUT_PATH,
      MONITOR_ML_OUTPUT: OUTPUT_PATH,
    }
  );

  const leitura = await executar(sandbox, "cat", [OUTPUT_PATH]).catch(() => null);
  const corpo = leitura?.stdout || "";

  let dados: {
    sucesso?: boolean;
    erro?: string;
    resultados?: ResultadoMercadoLivreLote[];
  } = {};

  if (corpo) {
    try {
      dados = JSON.parse(corpo);
    } catch {
      dados = {};
    }
  }

  if (execucao.resultado.exitCode !== 0 || dados.sucesso === false) {
    throw new Error(
      dados.erro ||
        execucao.stderr ||
        execucao.stdout ||
        "Falha executando lote do Mercado Livre."
    );
  }

  if (!Array.isArray(dados.resultados)) {
    throw new Error("Lote do Mercado Livre nao retornou resultados validos.");
  }

  return dados.resultados;
}
