import { Sandbox } from "@vercel/sandbox";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME =
  "achados-cupons-ml-test";

const WORKER_BASE_URL =
  "http://127.0.0.1:4317";

const MAX_PAGINAS = 30;
const PAUSA_VARREDURA_MS = 200;
const ANALISAR_RANKING = 8;
const PAUSA_RANKING_MS = 200;

type SandboxInstancia =
  Awaited<ReturnType<typeof Sandbox.get>>;

type HealthWorker = {
  sucesso?: boolean;
  servico?: string;
  navegadorConectado?: boolean;
};

type EstadoVarredura = {
  status?: string;
  erro?: string | null;
  paginas_planejadas?: number;
  paginas_lidas?: number;
  cupons_lidos?: number;
  vendedores_unicos?: number;
  progresso?: number;
};

function esperar(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function rodarComando(
  sandbox: SandboxInstancia,
  opcoes: {
    cmd: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
) {
  const resultado =
    await sandbox.runCommand(opcoes);

  const stdout =
    (await resultado.stdout()).trim();

  const stderr =
    (await resultado.stderr()).trim();

  return {
    resultado,
    stdout,
    stderr,
  };
}

async function consultarWorkerJson(
  sandbox: SandboxInstancia,
  caminho: string,
  timeoutSegundos = 30
): Promise<Record<string, any>> {
  const execucao =
    await rodarComando(
      sandbox,
      {
        cmd: "curl",
        args: [
          "-fsS",
          "--max-time",
          String(timeoutSegundos),
          `${WORKER_BASE_URL}${caminho}`,
        ],
      }
    );

  if (
    execucao.resultado.exitCode !== 0
  ) {
    throw new Error(
      execucao.stderr ||
        `Falha consultando ${caminho}.`
    );
  }

  let dados: Record<string, any>;

  try {
    dados = JSON.parse(
      execucao.stdout
    ) as Record<string, any>;
  } catch {
    throw new Error(
      `Resposta invalida do Worker em ${caminho}.`
    );
  }

  if (dados.sucesso === false) {
    throw new Error(
      String(
        dados.erro ||
          `Worker informou erro em ${caminho}.`
      )
    );
  }

  return dados;
}

async function consultarHealth(
  sandbox: SandboxInstancia
): Promise<HealthWorker | null> {
  try {
    const dados =
      await consultarWorkerJson(
        sandbox,
        "/health",
        5
      );

    return dados as HealthWorker;
  } catch {
    return null;
  }
}

async function garantirWorker(
  sandbox: SandboxInstancia
) {
  const healthExistente =
    await consultarHealth(sandbox);

  if (healthExistente?.sucesso) {
    return {
      iniciado_agora: false,
      health: healthExistente,
    };
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

  for (
    let tentativa = 1;
    tentativa <= 15;
    tentativa += 1
  ) {
    await esperar(2000);

    const health =
      await consultarHealth(sandbox);

    if (health?.sucesso) {
      return {
        iniciado_agora: true,
        health,
      };
    }
  }

  const log =
    await rodarComando(
      sandbox,
      {
        cmd: "tail",
        args: [
          "-n",
          "60",
          "/vercel/worker.log",
        ],
      }
    );

  throw new Error(
    `Worker nao respondeu ao health check. ${
      log.stdout ||
      log.stderr ||
      "Log vazio."
    }`
  );
}

async function validarSessaoMercadoLivre(
  sandbox: SandboxInstancia
) {
  const resposta =
    await consultarWorkerJson(
      sandbox,
      "/cupons-ml?pagina=1",
      60
    );

  return {
    total:
      Number(resposta.total || 0),
    recebidos:
      Number(resposta.recebidos || 0),
  };
}

async function executarVarreduraGlobal(
  sandbox: SandboxInstancia
): Promise<EstadoVarredura> {
  const statusAtual =
    await consultarWorkerJson(
      sandbox,
      "/cupons-varredura-status?limite=100",
      15
    );

  const estadoAtual =
    (statusAtual.estado ||
      {}) as EstadoVarredura;

  if (
    estadoAtual.status !== "executando"
  ) {
    await consultarWorkerJson(
      sandbox,
      `/cupons-varredura-iniciar?max_paginas=${MAX_PAGINAS}&pausa_ms=${PAUSA_VARREDURA_MS}`,
      30
    );
  }

  for (
    let tentativa = 1;
    tentativa <= 90;
    tentativa += 1
  ) {
    const resposta =
      await consultarWorkerJson(
        sandbox,
        "/cupons-varredura-status?limite=100",
        15
      );

    const estado =
      (resposta.estado ||
        {}) as EstadoVarredura;

    if (
      estado.status === "concluida"
    ) {
      return estado;
    }

    if (
      estado.status === "erro"
    ) {
      throw new Error(
        estado.erro ||
          "A varredura global terminou com erro."
      );
    }

    await esperar(2000);
  }

  throw new Error(
    "Tempo limite aguardando a varredura global."
  );
}

async function executarRankingGlobal(
  sandbox: SandboxInstancia
) {
  const execucao =
    await rodarComando(
      sandbox,
      {
        cmd: "node",
        args: [
          "/vercel/scripts/analisar-ranking-global-cupons.cjs",
          String(ANALISAR_RANKING),
          String(PAUSA_RANKING_MS),
        ],
        cwd: "/vercel",
        env: {
          PLAYWRIGHT_WORKER_URL:
            WORKER_BASE_URL,
        },
      }
    );

  if (
    execucao.resultado.exitCode !== 0
  ) {
    throw new Error(
      execucao.stderr ||
        execucao.stdout ||
        "Falha ao gerar ranking global."
    );
  }

  const arquivo =
    await rodarComando(
      sandbox,
      {
        cmd: "cat",
        args: [
          "/vercel/tmp/ranking-cupons-global.json",
        ],
      }
    );

  if (
    arquivo.resultado.exitCode !== 0 ||
    !arquivo.stdout
  ) {
    throw new Error(
      "ranking-cupons-global.json nao foi encontrado."
    );
  }

  try {
    return JSON.parse(
      arquivo.stdout
    ) as Record<string, any>;
  } catch {
    throw new Error(
      "ranking-cupons-global.json possui JSON invalido."
    );
  }
}

async function importarRankingSupabase(
  sandbox: SandboxInstancia
) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim() || "";

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY
      ?.trim() || "";

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Variaveis do Supabase nao configuradas no projeto Vercel."
    );
  }

  const execucao =
    await rodarComando(
      sandbox,
      {
        cmd: "node",
        args: [
          "/vercel/scripts/importar-ranking-cupons-supabase.cjs",
        ],
        cwd: "/vercel",
        env: {
          NEXT_PUBLIC_SUPABASE_URL:
            supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY:
            serviceRoleKey,
        },
      }
    );

  if (
    execucao.resultado.exitCode !== 0
  ) {
    throw new Error(
      execucao.stderr ||
        execucao.stdout ||
        "Falha importando ranking no Supabase."
    );
  }

  return execucao.stdout;
}

async function executarGeracaoEPublicacaoManual(
  sandbox: SandboxInstancia,
  campanhaId: string,
  sufixo: string
) {
  void sandbox;
  void sufixo;

  return {
    campanha_id: campanhaId,
    geracao:
      "bloqueada_ml_v2",
    publicacao:
      "bloqueada_aguardando_validacao_comprador",
    motivo:
      "O fluxo antigo de geracao/publicacao de cupons de seller foi desativado. O ML V2 usa somente cupons oficiais created_by=meli.",
  };
}

function autorizadoComoCron(
  request: NextRequest
) {
  const segredo =
    process.env.CRON_SECRET?.trim() ??
    "";

  if (!segredo) {
    return false;
  }

  const autorizacao =
    request.headers.get(
      "authorization"
    ) ?? "";

  return (
    autorizacao ===
    `Bearer ${segredo}`
  );
}

async function executarCupons(
  request: NextRequest
) {
  if (!autorizadoComoCron(request)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nao autorizado.",
      },
      {
        status: 401,
      }
    );
  }

  let sandbox:
    | SandboxInstancia
    | null = null;

  try {
    sandbox =
      await Sandbox.get({
        name: SANDBOX_NAME,
      });

    const worker =
      await garantirWorker(sandbox);

    const sessao =
      await validarSessaoMercadoLivre(
        sandbox
      );

    const varredura =
      await executarVarreduraGlobal(
        sandbox
      );

    const ranking =
      await executarRankingGlobal(
        sandbox
      );

    await importarRankingSupabase(
      sandbox
    );

    let mutacaoManual:
      | Record<string, any>
      | null = null;

    const confirmarMutacao =
      request.method === "POST" &&
      request.nextUrl.searchParams.get(
        "mutacao"
      ) === "CONFIRMAR";

    if (confirmarMutacao) {
      const campanhaId =
        (
          request.nextUrl.searchParams.get(
            "campanha"
          ) ?? ""
        ).trim();

      const sufixo =
        (
          request.nextUrl.searchParams.get(
            "sufixo"
          ) ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        !/^\d+$/.test(campanhaId)
      ) {
        throw new Error(
          "Campanha manual invalida."
        );
      }

      if (
        !/^[A-Z0-9]{1,9}$/.test(
          sufixo
        )
      ) {
        throw new Error(
          "Sufixo manual invalido."
        );
      }

      mutacaoManual =
        await executarGeracaoEPublicacaoManual(
          sandbox,
          campanhaId,
          sufixo
        );
    }

    const melhores =
      Array.isArray(ranking.ranking)
        ? ranking.ranking
            .slice(0, 3)
            .map(
              (
                item: Record<
                  string,
                  any
                >
              ) => ({
                posicao:
                  item.posicao,
                campanha_id:
                  item.cupom?.id,
                vendedor:
                  item.cupom
                    ?.vendedor,
                beneficio:
                  item.cupom
                    ?.titulo,
                score_demanda:
                  item.score_demanda,
                faixa:
                  item.faixa,
              })
            )
        : [];

    return NextResponse.json({
      sucesso: true,
      etapa:
        "ranking_global_importado",
      modo:
        mutacaoManual
          ? "mutacao_manual_confirmada"
          : "seguro_sem_geracao_publicacao",
      aviso:
        mutacaoManual
          ? "Mutacao manual solicitada explicitamente."
          : "Nenhum codigo foi gerado e nada foi publicado nesta execucao.",
      sandbox:
        SANDBOX_NAME,
      worker,
      sessao_mercado_livre:
        sessao,
      varredura: {
        status:
          varredura.status,
        paginas_planejadas:
          varredura.paginas_planejadas,
        paginas_lidas:
          varredura.paginas_lidas,
        cupons_lidos:
          varredura.cupons_lidos,
        vendedores_unicos:
          varredura.vendedores_unicos,
        progresso:
          varredura.progresso,
      },
      ranking: {
        analisados:
          ranking.origem
            ?.analisados_com_sucesso ??
          0,
        erros:
          ranking.origem?.erros ??
          0,
        melhores,
      },
      importacao_supabase:
        "concluida",
      mutacao_manual:
        mutacaoManual,
      executado_em:
        new Date().toISOString(),
    });
  } catch (erro) {
    console.error(
      "[CUPONS] Erro no orquestrador:",
      erro
    );

    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado no orquestrador de cupons.",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (sandbox) {
      await sandbox
        .stop()
        .catch((erro) => {
          console.error(
            "[CUPONS] Falha ao parar Sandbox:",
            erro
          );
        });
    }
  }
}

export async function GET(
  request: NextRequest
) {
  return executarCupons(request);
}

export async function POST(
  request: NextRequest
) {
  return executarCupons(request);
}
