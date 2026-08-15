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
  const execucao = await rodarComando(sandbox, {
    cmd: "curl",
    args: [
      "-fsS",
      "--max-time",
      String(timeoutSegundos),
      `${WORKER_BASE_URL}${caminho}`,
    ],
  });

  if (execucao.resultado.exitCode !== 0) {
    throw new Error(
      execucao.stderr || execucao.stdout || `Falha consultando ${caminho}.`
    );
  }

  let dados: Record<string, unknown>;

  try {
    dados = JSON.parse(execucao.stdout) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta invalida do Worker em ${caminho}.`);
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
