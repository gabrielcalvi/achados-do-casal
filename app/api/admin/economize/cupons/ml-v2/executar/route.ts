import { Sandbox } from "@vercel/sandbox";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME =
  "achados-cupons-ml-test";

const AUTH_STATE_PATH =
  "/vercel/tmp/meli-buyer-auth.json";

const COLLECTOR_PATH =
  "/vercel/scripts/coletar-cupons-oficiais-ml-v2.cjs";

const RESULT_PATH =
  "/vercel/tmp/ml-cupons-v2-oficiais.json";

const REPOSITORY =
  "gabrielcalvi/achados-do-casal";

type SandboxInstancia =
  Awaited<ReturnType<typeof Sandbox.get>>;

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

function autorizadoComoCron(
  request: NextRequest
) {
  const segredo =
    process.env.CRON_SECRET?.trim() ?? "";

  if (!segredo) {
    return false;
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${segredo}`
  );
}

async function usuarioAutenticado() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(
  request: NextRequest
) {
  if (autorizadoComoCron(request)) {
    return true;
  }

  return usuarioAutenticado();
}

function resumoCupom(
  cupom: Record<string, any>
) {
  return {
    campanha_id:
      cupom.campanha_id ?? null,
    titulo:
      cupom.titulo ?? null,
    valor_desconto:
      cupom.valor_desconto ?? null,
    compra_minima:
      cupom.compra_minima ?? null,
    validade:
      cupom.validade ?? null,
    escopo:
      cupom.escopo ?? null,
    criado_por:
      cupom.criado_por ?? null,
  };
}

export async function GET(
  request: NextRequest
) {
  if (!(await autorizado(request))) {
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
    sandbox = await Sandbox.get({
      name: SANDBOX_NAME,
    });

    const diretorios =
      await rodarComando(
        sandbox,
        {
          cmd: "mkdir",
          args: [
            "-p",
            "/vercel/scripts",
            "/vercel/tmp",
          ],
        }
      );

    if (
      diretorios.resultado.exitCode !== 0
    ) {
      throw new Error(
        diretorios.stderr ||
          "Falha preparando diretorios do Sandbox."
      );
    }

    const auth =
      await rodarComando(
        sandbox,
        {
          cmd: "test",
          args: [
            "-s",
            AUTH_STATE_PATH,
          ],
        }
      );

    if (auth.resultado.exitCode !== 0) {
      throw new Error(
        "Sessao de comprador do Mercado Livre nao encontrada no Sandbox."
      );
    }

    const commit =
      process.env.VERCEL_GIT_COMMIT_SHA
        ?.trim() || "main";

    const collectorUrl =
      `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(
        commit
      )}/scripts/coletar-cupons-oficiais-ml-v2.cjs`;

    const download =
      await rodarComando(
        sandbox,
        {
          cmd: "curl",
          args: [
            "-fsSL",
            "--max-time",
            "30",
            collectorUrl,
            "-o",
            COLLECTOR_PATH,
          ],
        }
      );

    if (download.resultado.exitCode !== 0) {
      throw new Error(
        download.stderr ||
          "Falha sincronizando o coletor ML V2 com o Sandbox."
      );
    }

    const execucao =
      await rodarComando(
        sandbox,
        {
          cmd: "xvfb-run",
          args: [
            "-a",
            "node",
            COLLECTOR_PATH,
          ],
          cwd: "/vercel",
          env: {
            MELI_BUYER_AUTH_STATE_PATH:
              AUTH_STATE_PATH,
          },
        }
      );

    if (execucao.resultado.exitCode !== 0) {
      throw new Error(
        execucao.stderr ||
          execucao.stdout ||
          "Falha executando o coletor ML V2."
      );
    }

    const arquivo =
      await rodarComando(
        sandbox,
        {
          cmd: "cat",
          args: [RESULT_PATH],
        }
      );

    if (
      arquivo.resultado.exitCode !== 0 ||
      !arquivo.stdout
    ) {
      throw new Error(
        "O coletor terminou sem gerar o resultado ML V2."
      );
    }

    let resultado:
      Record<string, any>;

    try {
      resultado = JSON.parse(
        arquivo.stdout
      ) as Record<string, any>;
    } catch {
      throw new Error(
        "O resultado ML V2 possui JSON invalido."
      );
    }

    const cupons =
      Array.isArray(resultado.cupons)
        ? resultado.cupons
        : [];

    return NextResponse.json({
      sucesso: true,
      versao: "ml-v2",
      fonte:
        "central_comprador_mercado_livre",
      regra:
        "somente cupons created_by=meli, FIXED, validos e sem restricao de item, vendedor, categoria, marca ou produto",
      afiliado_obrigatorio_antes_publicacao:
        true,
      publicacao_automatica:
        false,
      persistencia_supabase:
        false,
      commit_coletor:
        commit,
      total_paginas_lidas:
        Number(
          resultado.total_paginas_lidas || 0
        ),
      total_encontrados:
        Number(
          resultado.total_encontrados || 0
        ),
      valores_encontrados:
        Array.isArray(
          resultado.valores_encontrados
        )
          ? resultado.valores_encontrados
          : [],
      por_valor:
        resultado.por_valor || {},
      amostra:
        cupons
          .slice(0, 12)
          .map(resumoCupom),
      executado_em:
        new Date().toISOString(),
    });
  } catch (erro) {
    console.error(
      "[ML V2] Erro na coleta segura:",
      erro
    );

    return NextResponse.json(
      {
        sucesso: false,
        publicacao_automatica: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado no ML V2.",
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
            "[ML V2] Falha ao parar Sandbox:",
            erro
          );
        });
    }
  }
}