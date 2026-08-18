import { Sandbox } from "@vercel/sandbox";
import type { ProdutoExtraidoWorker } from "@/lib/workers/playwrightWorker";

const SANDBOX_NAME = "achados-cupons-ml-test";
const WORKER_BASE_URL = "http://127.0.0.1:4317";
const BUYER_AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const FALLBACK_AUTH_STATE_PATH = "/vercel/tmp/meli-auth.json";

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

  const numero = itemId.replace(/^MLB/i, "");

  return `https://produto.mercadolivre.com.br/MLB-${numero}-_JM`;
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

async function escolherAuthState(sandbox: SandboxInstancia) {
  if (await arquivoExiste(sandbox, BUYER_AUTH_STATE_PATH)) {
    return BUYER_AUTH_STATE_PATH;
  }

  if (await arquivoExiste(sandbox, FALLBACK_AUTH_STATE_PATH)) {
    return FALLBACK_AUTH_STATE_PATH;
  }

  throw new Error(
    "Nenhuma sessao autenticada do Mercado Livre foi encontrada no Sandbox."
  );
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

async function garantirWorker(
  sandbox: SandboxInstancia,
  authStatePath: string
) {
  const atual = await health(sandbox);

  if (atual?.sucesso === true) {
    return;
  }

  console.log(`[MONITOR ML] Sessao escolhida: ${authStatePath}`);

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      [
        "rm -f /vercel/.playwright-profile/Singleton*;",
        "exec env",
        `MELI_AUTH_STATE_PATH=${authStatePath}`,
        "PLAYWRIGHT_HEADLESS=false",
        "xvfb-run -a node /vercel/playwright-worker.cjs",
        ">/vercel/worker.log 2>&1",
      ].join(" "),
    ],
    cwd: "/vercel",
    detached: true,
  });

  for (let tentativa = 1; tentativa <= 30; tentativa += 1) {
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
  const authStatePath = await escolherAuthState(sandbox);

  console.log(`[MONITOR ML] Auth state selecionado: ${authStatePath}`);
  await garantirWorker(sandbox, authStatePath);

  return {
    async extrair(link: string) {
      const linkDireto = urlDiretaAnuncio(link);
      const linkTeste = linkDireto || link;

      console.log(
        `[MONITOR ML] Link usado no Sandbox: ${linkTeste}`
      );

      const dados = await consultarJson(
        sandbox,
        `/extrair?url=${encodeURIComponent(linkTeste)}`,
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
