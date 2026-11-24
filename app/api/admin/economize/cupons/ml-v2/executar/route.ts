import { Sandbox } from "@vercel/sandbox";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { persistirCandidatosMlV2 } from "@/lib/services/mlV2Candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const AUTH_STATE_FALLBACK_PATH = "/vercel/tmp/meli-auth.json";
const COLLECTOR_PATH = "/vercel/scripts/coletar-cupons-oficiais-ml-v2-lote.cjs";
const RESULT_PATH = "/vercel/tmp/ml-cupons-v2-oficiais.json";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const MAX_PAGINAS_LOTE = 20;

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;
type ExecucaoComando = Awaited<ReturnType<typeof rodarComando>>;

type EstadoCandidato = {
  id: string;
  campanha_externa_id: string | null;
  status: string | null;
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

function resumoCupom(
  cupom: Record<string, any>,
  estado?: EstadoCandidato
) {
  return {
    candidato_id: estado?.id ?? null,
    status: estado?.status ?? "coletado",
    campanha_id: cupom.campanha_id ?? null,
    titulo: cupom.titulo ?? null,
    valor_desconto: cupom.valor_desconto ?? null,
    compra_minima: cupom.compra_minima ?? null,
    validade: cupom.validade ?? null,
    escopo: cupom.escopo ?? null,
    criado_por: cupom.criado_por ?? null,
    acao: cupom.acao ?? null,
    tipo_acao: cupom.tipo_acao ?? null,
    possui_token_ativacao: Boolean(cupom.possui_token_ativacao),
    quantidade_produtos: Array.isArray(cupom.produtos)
      ? cupom.produtos.length
      : 0,
  };
}

function erroSessaoInvalida(execucao: ExecucaoComando) {
  return `${execucao.stderr}\n${execucao.stdout}`.includes(
    "Sessao comprador invalida"
  );
}

async function arquivoExiste(sandbox: SandboxInstancia, caminho: string) {
  const teste = await rodarComando(sandbox, {
    cmd: "test",
    args: ["-s", caminho],
  });

  return teste.resultado.exitCode === 0;
}

async function executarColetor(
  sandbox: SandboxInstancia,
  authStatePath: string
) {
  return rodarComando(sandbox, {
    cmd: "xvfb-run",
    args: ["-a", "node", COLLECTOR_PATH],
    cwd: "/vercel",
    env: {
      MELI_BUYER_AUTH_STATE_PATH: authStatePath,
      ML_V2_MAX_PAGES: String(MAX_PAGINAS_LOTE),
    },
  });
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const { data: dispositivo } = await supabaseAdmin
    .from("local_agent_devices")
    .select("id,name")
    .is("revoked_at", null)
    .gte("last_seen_at", new Date(Date.now() - 45000).toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!dispositivo) {
    return NextResponse.json({
      sucesso: false,
      agente_local_offline: true,
      erro: "Agente local offline. No computador com Chrome logado, execute npm run ml:agent.",
    }, { status: 503 });
  }

  const { data: tarefa, error: erroCriacao } = await supabaseAdmin
    .from("local_agent_jobs")
    .insert({ task_type: "coupon_collect" })
    .select("id")
    .single();

  if (erroCriacao || !tarefa) {
    return NextResponse.json({ sucesso: false, erro: erroCriacao?.message || "Nao foi possivel enfileirar a coleta." }, { status: 500 });
  }

  const limite = Date.now() + 240000;
  while (Date.now() < limite) {
    const { data: estado, error } = await supabaseAdmin
      .from("local_agent_jobs")
      .select("status,result,error")
      .eq("id", tarefa.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
    }

    if (estado?.status === "completed") {
      const resultado = (estado.result || {}) as Record<string, any>;
      return NextResponse.json({
        sucesso: true,
        versao: "ml-v2-local-agent",
        modo_execucao: "chrome_local",
        dispositivo: dispositivo.name,
        publicacao_automatica: false,
        total_paginas_lidas: Number(resultado.total_paginas_lidas || 0),
        total_encontrados: Number(resultado.total_encontrados || 0),
        valores_encontrados: Array.isArray(resultado.valores_encontrados) ? resultado.valores_encontrados : [],
        varredura_completa: Boolean(resultado.varredura_completa),
        amostra: Array.isArray(resultado.amostra) ? resultado.amostra : [],
        executado_em: new Date().toISOString(),
      });
    }

    if (estado?.status === "failed") {
      return NextResponse.json({ sucesso: false, erro: estado.error || "A coleta local falhou." }, { status: 502 });
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return NextResponse.json({
    sucesso: false,
    erro: "A coleta local continua em andamento. Atualize a lista de candidatos em instantes.",
    tarefa_id: tarefa.id,
  }, { status: 202 });
}
