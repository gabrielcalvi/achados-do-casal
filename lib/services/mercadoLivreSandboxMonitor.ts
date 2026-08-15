import { Sandbox } from "@vercel/sandbox";
import type { ProdutoExtraidoWorker } from "@/lib/workers/playwrightWorker";

const SANDBOX_NAME = "achados-cupons-ml-test";
const WORKER_BASE_URL = "http://127.0.0.1:4317";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

export type SessaoMonitorMercadoLivre = {
  extrair: (link: string) => Promise<ProdutoExtraidoWorker>;
  fechar: () => Promise<void>;
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function consultarJson(
  sandbox: SandboxInstancia,
  caminho: string,
  timeoutSegundos = 45
): Promise<Record<string, unknown>> {
  const marcadorStatus = "__HTTP_STATUS__";

  const execucao = await rodarComando(sandbox, {
    cmd: "curl",
    args: [
      "-sS",
      "--max-time",
      String(timeoutSegundos),
      "-w",
      `\n${marcadorStatus}%{http_code}`,
      `${WORKER_BASE_URL}${caminho}`,
    ],
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
      args: ["-n", "40", "/vercel/worker.log"],
    }).catch(() => null);

    const detalheLog = log?.stdout
      ? ` | Worker log: ${log.stdout.slice(-2500)}`
      : "";

    throw new Error(
      `Worker Sandbox respondeu ${statusTexto || "erro"}: ${erroWorker}${detalheLog}`
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
    return await consultarJson(sandbox, "/health", 5);
  } catch {
    return null;
  }
}

async function garantirWorker(sandbox: SandboxInstancia) {
  const atual = await health(sandbox);

  if (atual?.sucesso === true) {
    return;
  }

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      [
        "rm -f /vercel/.playwright-profile/Singleton*;",
        "exec env",
        "MELI_AUTH_STATE_PATH=/vercel/tmp/meli-auth.json",
        "PLAYWRIGHT_HEADLESS=false",
        "xvfb-run -a node /vercel/playwright-worker.cjs",
        ">/vercel/worker.log 2>&1",
      ].join(" "),
    ],
    cwd: "/vercel",
    detached: true,
  });

  for (let tentativa = 1; tentativa <= 15; tentativa += 1) {
    await esperar(2000);

    const resposta = await health(sandbox);

    if (resposta?.sucesso === true) {
      return;
    }
  }

  const log = await rodarComando(sandbox, {
    cmd: "tail",
    args: ["-n", "60", "/vercel/worker.log"],
  });

  throw new Error(
    `Worker do Sandbox nao respondeu. ${log.stdout || log.stderr || "Log vazio."}`
  );
}

export async function criarSessaoMonitorMercadoLivre(): Promise<SessaoMonitorMercadoLivre> {
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME });

  await garantirWorker(sandbox);

  return {
    async extrair(link: string) {
      const dados = await consultarJson(
        sandbox,
        `/extrair?url=${encodeURIComponent(link)}`,
        60
      );

      const produto = dados.dados as ProdutoExtraidoWorker | undefined;

      if (!produto?.precoAtual) {
        throw new Error("Worker do Sandbox nao retornou preco do Mercado Livre.");
      }

      return produto;
    },
    async fechar() {
      await sandbox.stop().catch((erro) => {
        console.error("[MONITOR ML] Falha ao parar Sandbox:", erro);
      });
    },
  };
}
