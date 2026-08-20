import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/scripts/varrer-produtos-awin-legacy.cjs";
const WRAPPER_PATH = "/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs";
const CONFIG_PATH = "/vercel/scripts/awin-lojas.config.cjs";
const STATUS_PATH = "/vercel/tmp/awin-produtos-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-resultado.json";
const LOG_PATH = "/vercel/tmp/awin-produtos.log";
const EXIT_PATH = "/vercel/tmp/awin-produtos-exit.txt";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function autorizado(request: NextRequest) {
  return autorizadoComoCron(request) || usuarioAutenticado();
}

async function comando(sandbox: SandboxInstancia, cmd: string, args: string[], env?: Record<string, string>) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel", env });
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();
  return { resultado, stdout, stderr };
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const leitura = await comando(sandbox, "cat", [caminho]);
  if (leitura.resultado.exitCode !== 0 || !leitura.stdout) return null;
  try { return JSON.parse(leitura.stdout) as Record<string, unknown>; } catch { return null; }
}

async function processoVarreduraAtivo(sandbox: SandboxInstancia) {
  const processos = await comando(sandbox, "ps", ["-eo", "pid=,args="]);
  if (processos.resultado.exitCode !== 0) return false;
  return processos.stdout.split("\n").some((linha) => {
    const valor = linha.trim();
    return valor.includes("node") && (
      valor.includes("varrer-produtos-awin-legacy-wrapper.cjs") ||
      valor.includes("varrer-produtos-awin-legacy-normalizado.cjs") ||
      valor.includes("varrer-produtos-awin-legacy.cjs")
    );
  });
}

async function status(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const dados = (await lerJson(sandbox, STATUS_PATH)) || (await lerJson(sandbox, RESULT_PATH)) || { executando: false, mensagem: "Nenhuma varredura executada ainda." };
    return NextResponse.json({ sucesso: true, sandbox: SANDBOX_NAME, status: dados });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ sucesso: false, erro: "Variaveis AWIN/Data Feed/Supabase incompletas." }, { status: 500 });
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await comando(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos = [
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`, SCRIPT_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy-wrapper.cjs`, WRAPPER_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`, CONFIG_PATH],
    ];

    for (const [url, destino] of arquivos) {
      const download = await comando(sandbox, "curl", ["-fsSL", "--max-time", "30", url, "-o", destino]);
      if (download.resultado.exitCode !== 0) throw new Error(download.stderr || `Falha sincronizando ${destino}.`);
    }

    const anterior = await lerJson(sandbox, STATUS_PATH);
    if (anterior?.executando === true && await processoVarreduraAtivo(sandbox)) {
      return NextResponse.json({ sucesso: true, iniciado: false, motivo: "execucao_em_andamento", status: anterior }, { status: 202 });
    }

    await comando(sandbox, "rm", ["-f", LOG_PATH, EXIT_PATH]);

    const env = {
      AWIN_API_TOKEN: awinToken,
      AWIN_DATAFEED_API_KEY: datafeedKey,
      AWIN_PUBLISHER_ID: publisher,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      AWIN_PRODUTOS_LOJAS: "cea",
      AWIN_PRODUTOS_LIMITE_POR_LOJA: "120",
      AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      AWIN_PRODUTOS_CATALOGO_LOJAS: "cea",
    };

    await sandbox.runCommand({
      cmd: "sh",
      args: ["-lc", `node ${WRAPPER_PATH} CONFIRMAR > ${LOG_PATH} 2>&1; echo $? > ${EXIT_PATH}`],
      cwd: "/vercel",
      env,
      detached: true,
    });

    return NextResponse.json({
      sucesso: true,
      iniciado: true,
      modo: "varredura_catalogo_cea_diversificado",
      lojas: ["cea"],
      limite_publicacao_por_loja: 120,
      desconto_minimo_percentual: 10,
      catalogo_sem_desconto_inventado: ["cea"],
      afiliado_obrigatorio: true,
      sandbox: SANDBOX_NAME,
      commit_script: commit,
      iniciadoEm: new Date().toISOString(),
    }, { status: 202 });
  } catch (erro) {
    console.error("[AWIN produtos] Falha no executor:", erro);
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "1") return status(request);
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
