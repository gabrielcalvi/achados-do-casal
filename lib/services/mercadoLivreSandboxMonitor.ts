import { Sandbox } from "@vercel/sandbox";
import type { ProdutoExtraidoWorker } from "@/lib/workers/playwrightWorker";

const SANDBOX_NAME = "achados-cupons-ml-test";
const WORKER_BASE_URL = "http://127.0.0.1:4318";
const WORKER_PATH = "/vercel/monitor-worker/monitor-mercado-livre-worker.cjs";
const EXTRACTOR_PATH = "/vercel/monitor-worker/extractors/mercado-livre.cjs";
const HELPERS_PATH = "/vercel/monitor-worker/extractors/helpers.cjs";
const LOG_PATH = "/vercel/monitor-worker.log";
const BUYER_AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const REPOSITORY = "gabrielcalvi/achados-do-casal";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

export type SessaoMonitorMercadoLivre = {
  extrair: (link: string) => Promise<ProdutoExtraidoWorker>;
  fechar: () => Promise<void>;
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

      if (match?.[1]) {
        return `MLB${match[1]}`;
      }
    }
  } catch {
    const match = link.match(/MLB[-:]?(\d{8,})/i);

    if (match?.[1]) {
      return `MLB${match[1]}`;
    }
  }

  return null;
}

function urlDiretaAnuncio(link: string) {
  const itemId = extrairItemIdMercadoLivre(link);

  if (!itemId) {
    return null;
  }

  return `https://produto.mercadolivre.com.br/MLB-${itemId.replace(/^MLB/i, "")}-_JM`;
}

async function rodarComando(
  sandbox: SandboxInstancia,
  opcoes: {
    cmd: string;
    args: string[];
    cwd?: string;
  }
) {
  const resultado = await sandbox.runCommand(opcoes);
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();

  return { resultado, stdout, stderr };
}

async function arquivoExiste(sandbox: SandboxInstancia, caminho: string) {
  const teste = await sandbox.runCommand({
    cmd: "test",
    args: ["-s", caminho],
  });

  return teste.exitCode === 0;
}

async function consultarJson(
  sandbox: SandboxInstancia,
  caminho: string,
  timeoutSegundos = 45,
  metodo: "GET" | "POST" = "GET"
): Promise<Record<string, unknown>> {
  const marcadorStatus = "__HTTP_STATUS__";
  const args = [
    "-sS",
    "--max-time",
    String(timeoutSegundos),
    "-X",
    metodo,
    "-w",
    `\n${marcadorStatus}%{http_code}`,
    `${WORKER_BASE_URL}${caminho}`,
  ];

  const execucao = await rodarComando(sandbox, {
    cmd: "curl",
    args,
  });

  if (execucao.resultado.exitCode !== 0) {
    throw new Error(
      execucao.stderr || execucao.stdout || `Falha consultando ${caminho}.`
    );
  }

  const indiceStatus = execucao.stdout.lastIndexOf(`\n${marcadorStatus}`);

  if (indiceStatus < 0) {
    throw new Error(`Resposta sem status HTTP do Worker em ${caminho}.`);
  }

  const corpo = execucao.stdout.slice(0, indiceStatus).trim();
  const statusTexto = execucao.stdout
    .slice(indiceStatus + 1 + marcadorStatus.length)
    .trim();
  const status = Number(statusTexto);

  let dados: Record<string, unknown> | null = null;

  if (corpo) {
    try {
      dados = JSON.parse(corpo) as Record<string, unknown>;
    } catch {
      dados = null;
    }
  }

  if (!Number.isFinite(status) || status >= 400) {
    const erroWorker =
      dados && typeof dados.erro === "string"
        ? dados.erro
        : corpo || `HTTP ${statusTexto || "desconhecido"}`;

    const log = await rodarComando(sandbox, {
      cmd: "tail",
      args: ["-n", "60", LOG_PATH],
    }).catch(() => null);

    const detalheLog = log?.stdout
      ? ` | Monitor worker log: ${log.stdout.slice(-3000)}`
      : "";

    throw new Error(
      `Worker isolado do monitor respondeu ${statusTexto || "erro"}: ${erroWorker}${detalheLog}`
    );
  }

  if (!dados) {
    throw new Error(`Resposta invalida do Worker em ${caminho}: ${corpo}`);
  }

  if (dados.sucesso === false) {
    throw new Error(String(dados.erro || `Worker informou erro em ${caminho}.`));
  }

  return dados;
}

async function health(sandbox: SandboxInstancia) {
  try {
    return await consultarJson(sandbox, "/health", 4);
  } catch {
    return null;
  }
}

async function baixarArquivo(
  sandbox: SandboxInstancia,
  origem: string,
  destino: string
) {
  const download = await rodarComando(sandbox, {
    cmd: "curl",
    args: ["-fsSL", "--max-time", "30", origem, "-o", destino],
  });

  if (download.resultado.exitCode !== 0) {
    throw new Error(
      download.stderr || `Falha ao preparar ${destino} no Sandbox.`
    );
  }
}

async function prepararWorker(sandbox: SandboxInstancia) {
  if (!(await arquivoExiste(sandbox, BUYER_AUTH_STATE_PATH))) {
    throw new Error(
      "Sessao buyer do Mercado Livre nao encontrada no Sandbox. Renove a sessao ML V2 antes de executar o monitor."
    );
  }

  const diretorios = await rodarComando(sandbox, {
    cmd: "mkdir",
    args: ["-p", "/vercel/monitor-worker/extractors"],
  });

  if (diretorios.resultado.exitCode !== 0) {
    throw new Error(
      diretorios.stderr || "Falha preparando o worker isolado do monitor."
    );
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
  const base = `https://raw.githubusercontent.com/${REPOSITORY}/${commit}`;

  await baixarArquivo(
    sandbox,
    `${base}/scripts/monitor-mercado-livre-worker.cjs`,
    WORKER_PATH
  );
  await baixarArquivo(
    sandbox,
    `${base}/scripts/extractors/mercado-livre.cjs`,
    EXTRACTOR_PATH
  );
  await baixarArquivo(
    sandbox,
    `${base}/scripts/extractors/helpers.cjs`,
    HELPERS_PATH
  );
}

async function pararWorkerIsolado(sandbox: SandboxInstancia) {
  if (!(await health(sandbox))) {
    return;
  }

  await consultarJson(sandbox, "/shutdown", 8, "POST").catch(() => undefined);

  for (let tentativa = 1; tentativa <= 10; tentativa += 1) {
    await esperar(300);

    if (!(await health(sandbox))) {
      return;
    }
  }
}

async function iniciarWorkerIsolado(sandbox: SandboxInstancia) {
  await pararWorkerIsolado(sandbox);
  await prepararWorker(sandbox);

  console.log("[MONITOR ML] Iniciando Worker isolado na porta 4318 com sessao buyer.");

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      [
        "exec env",
        `MELI_BUYER_AUTH_STATE_PATH=${BUYER_AUTH_STATE_PATH}`,
        "MONITOR_ML_PORT=4318",
        `xvfb-run -a node ${WORKER_PATH}`,
        `>${LOG_PATH} 2>&1`,
      ].join(" "),
    ],
    cwd: "/vercel",
    detached: true,
  });

  for (let tentativa = 1; tentativa <= 20; tentativa += 1) {
    await esperar(500);

    const resposta = await health(sandbox);

    if (resposta?.sucesso === true) {
      console.log("[MONITOR ML] Worker isolado pronto.");
      return;
    }
  }

  const log = await rodarComando(sandbox, {
    cmd: "tail",
    args: ["-n", "80", LOG_PATH],
  });

  throw new Error(
    `Worker isolado do monitor nao iniciou. ${log.stdout || log.stderr || "Log vazio."}`
  );
}

export async function criarSessaoMonitorMercadoLivre(): Promise<SessaoMonitorMercadoLivre> {
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME });

  await iniciarWorkerIsolado(sandbox);

  return {
    async extrair(link: string) {
      const linkDireto = urlDiretaAnuncio(link);
      const linkTeste = linkDireto || link;

      console.log(`[MONITOR ML] Link usado no Worker isolado: ${linkTeste}`);

      const dados = await consultarJson(
        sandbox,
        `/extrair?url=${encodeURIComponent(linkTeste)}`,
        60
      );

      const produto = dados.dados as ProdutoExtraidoWorker | undefined;

      if (!produto?.precoAtual) {
        throw new Error("Worker isolado nao retornou preco do Mercado Livre.");
      }

      return produto;
    },
    async fechar() {
      await pararWorkerIsolado(sandbox).catch((erro) => {
        console.error("[MONITOR ML] Falha ao encerrar Worker isolado:", erro);
      });
    },
  };
}
