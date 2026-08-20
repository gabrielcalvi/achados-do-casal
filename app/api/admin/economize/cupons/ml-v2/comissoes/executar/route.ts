import { Sandbox } from "@vercel/sandbox";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_STATE_PATH = "/vercel/tmp/meli-auth.json";
const SCRIPT_PATH = "/vercel/scripts/verificar-comissoes-ml-v2.cjs";
const RESULT_PATH = "/vercel/tmp/ml-v2-comissoes.json";
const PROGRESS_PATH = "/vercel/tmp/ml-v2-comissoes-progresso.json";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const MAX_CANDIDATOS = 100;

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

type ResultadoComissao = {
  item_id?: string;
  percentual?: number | null;
  status?: string;
  erro?: string;
  url_final?: string;
  verificada_em?: string;
};

async function rodarComando(
  sandbox: SandboxInstancia,
  opcoes: {
    cmd: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
) {
  const resultado = await sandbox.runCommand(opcoes);
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();

  return { resultado, stdout, stderr };
}

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() ?? "";
  if (!segredo) return false;

  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(request: NextRequest) {
  if (autorizadoComoCron(request)) return true;
  return usuarioAutenticado();
}

function primeiroItemId(dadosBrutos: unknown) {
  const bruto = (dadosBrutos || {}) as Record<string, unknown>;
  const itemIds = Array.isArray(bruto.item_ids) ? bruto.item_ids : [];

  const primeiro = String(itemIds[0] || "").trim().toUpperCase();
  return /^MLB\d+$/.test(primeiro) ? primeiro : null;
}

export async function POST(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  let sandbox: SandboxInstancia | null = null;
  const execucaoId = crypto.randomUUID();

  try {
    const { data: candidatos, error: erroCandidatos } = await supabaseAdmin
      .from("economize_cupons_candidatos")
      .select("id,status,dados_brutos,ultima_coleta_em")
      .eq("origem", "mercado_livre_v2")
      .neq("status", "descartado")
      .order("ultima_coleta_em", { ascending: false })
      .limit(MAX_CANDIDATOS);

    if (erroCandidatos) {
      throw new Error(`Falha lendo candidatos: ${erroCandidatos.message}`);
    }

    const candidatosComItem = (candidatos || []).flatMap((candidato) => {
      const itemId = primeiroItemId(candidato.dados_brutos);
      return itemId ? [{ candidato, itemId }] : [];
    });

    const itemIds = [...new Set(candidatosComItem.map((item) => item.itemId))];

    if (itemIds.length === 0) {
      return NextResponse.json({
        sucesso: true,
        execucao_id: execucaoId,
        total_consultados: 0,
        com_comissao: 0,
        comissao_zero: 0,
        nao_identificados: 0,
      });
    }

    sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const preparar = await rodarComando(sandbox, {
      cmd: "mkdir",
      args: ["-p", "/vercel/scripts", "/vercel/tmp"],
    });

    if (preparar.resultado.exitCode !== 0) {
      throw new Error(
        preparar.stderr || "Falha preparando diretorios do Sandbox."
      );
    }

    await rodarComando(sandbox, {
      cmd: "rm",
      args: ["-f", RESULT_PATH, PROGRESS_PATH],
    });

    const auth = await rodarComando(sandbox, {
      cmd: "test",
      args: ["-s", AUTH_STATE_PATH],
    });

    if (auth.resultado.exitCode !== 0) {
      throw new Error(
        "A sessao afiliada do Mercado Livre nao esta disponivel no Sandbox. Renove a sessao antes de verificar comissoes."
      );
    }

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const scriptUrl = `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(
      commit
    )}/scripts/verificar-comissoes-ml-v2.cjs`;

    const download = await rodarComando(sandbox, {
      cmd: "curl",
      args: [
        "-fsSL",
        "--max-time",
        "30",
        scriptUrl,
        "-o",
        SCRIPT_PATH,
      ],
    });

    if (download.resultado.exitCode !== 0) {
      throw new Error(
        download.stderr || "Falha sincronizando o verificador de comissoes ML V2."
      );
    }

    const execucao = await rodarComando(sandbox, {
      cmd: "xvfb-run",
      args: ["-a", "node", SCRIPT_PATH],
      cwd: "/vercel",
      env: {
        MELI_AFFILIATE_AUTH_STATE_PATH: AUTH_STATE_PATH,
        ML_V2_COMISSOES_RESULT_PATH: RESULT_PATH,
        ML_V2_COMISSOES_PROGRESS_PATH: PROGRESS_PATH,
        ML_V2_COMISSOES_EXECUTION_ID: execucaoId,
        ML_V2_COMISSOES_CONCURRENCY: "3",
        ML_V2_ITEM_IDS: JSON.stringify(itemIds),
      },
    });

    if (execucao.resultado.exitCode !== 0) {
      throw new Error(
        execucao.stderr || execucao.stdout || "Falha verificando comissoes ML V2."
      );
    }

    const arquivo = await rodarComando(sandbox, {
      cmd: "cat",
      args: [RESULT_PATH],
    });

    if (arquivo.resultado.exitCode !== 0 || !arquivo.stdout) {
      throw new Error("O verificador terminou sem gerar o resultado de comissoes.");
    }

    const resultado = JSON.parse(arquivo.stdout) as {
      resultados?: ResultadoComissao[];
    };

    const resultados = Array.isArray(resultado.resultados)
      ? resultado.resultados
      : [];

    const porItem = new Map(
      resultados
        .filter((item) => item.item_id)
        .map((item) => [String(item.item_id), item])
    );

    let atualizados = 0;

    for (const { candidato, itemId } of candidatosComItem) {
      const comissao = porItem.get(itemId);
      if (!comissao) continue;

      const bruto = {
        ...((candidato.dados_brutos || {}) as Record<string, unknown>),
        comissao_afiliado: {
          item_id: itemId,
          percentual:
            typeof comissao.percentual === "number" ? comissao.percentual : null,
          status: comissao.status || "nao_identificada",
          erro: comissao.erro || null,
          url_final: comissao.url_final || null,
          verificada_em: comissao.verificada_em || new Date().toISOString(),
          fonte: "toolbar_afiliados_mercado_livre",
          observacao: "estimativa baseada no primeiro item participante",
        },
      };

      const { error: erroUpdate } = await supabaseAdmin
        .from("economize_cupons_candidatos")
        .update({
          dados_brutos: bruto,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidato.id);

      if (erroUpdate) {
        console.error(
          `[ML V2 comissoes] Falha atualizando ${candidato.id}:`,
          erroUpdate.message
        );
        continue;
      }

      atualizados += 1;
    }

    const comissaoZero = resultados.filter((item) => item.percentual === 0).length;
    const comComissao = resultados.filter(
      (item) => typeof item.percentual === "number" && item.percentual > 0
    ).length;
    const naoIdentificados = resultados.length - comissaoZero - comComissao;

    return NextResponse.json({
      sucesso: true,
      execucao_id: execucaoId,
      total_consultados: resultados.length,
      candidatos_atualizados: atualizados,
      com_comissao: comComissao,
      comissao_zero: comissaoZero,
      nao_identificados: naoIdentificados,
      executado_em: new Date().toISOString(),
    });
  } catch (erro) {
    console.error("[ML V2 comissoes] Erro:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        execucao_id: execucaoId,
        erro: erro instanceof Error ? erro.message : "Erro inesperado.",
      },
      { status: 500 }
    );
  } finally {
    if (sandbox) {
      await sandbox.stop().catch((erro) => {
        console.error("[ML V2 comissoes] Falha ao parar Sandbox:", erro);
      });
    }
  }
}
