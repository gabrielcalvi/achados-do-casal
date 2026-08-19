import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/scripts/varrer-produtos-awin-kabum.cjs";
const BASE_PATH = "/vercel/scripts/varrer-produtos-awin-legacy.cjs";
const CONFIG_PATH = "/vercel/scripts/awin-lojas.config.cjs";
const STATUS_PATH = "/vercel/tmp/awin-kabum-produtos-status.json";
const RESULT_PATH = "/vercel/tmp/awin-kabum-produtos-resultado.json";

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

async function lerJson(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, caminho: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [caminho], cwd: "/vercel" });
  if (resultado.exitCode !== 0) return null;
  const texto = (await resultado.stdout()).trim();
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

async function status(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const dados = (await lerJson(sandbox, STATUS_PATH)) || (await lerJson(sandbox, RESULT_PATH));
    return NextResponse.json({ sucesso: true, sandbox: SANDBOX_NAME, status: dados || { executando: false, mensagem: "Sem execucao registrada." } });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { sucesso: false, erro: "Variaveis AWIN/Data Feed/Supabase incompletas." },
      { status: 500 },
    );
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await sandbox.runCommand({ cmd: "mkdir", args: ["-p", "/vercel/scripts", "/vercel/tmp"], cwd: "/vercel" });

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos = [
      ["scripts/varrer-produtos-awin-kabum.cjs", SCRIPT_PATH],
      ["scripts/varrer-produtos-awin-legacy.cjs", BASE_PATH],
      ["scripts/awin-lojas.config.cjs", CONFIG_PATH],
    ];

    for (const [arquivo, destino] of arquivos) {
      const url = `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/${arquivo}`;
      const resultado = await sandbox.runCommand({
        cmd: "curl",
        args: ["-fsSL", "--max-time", "30", url, "-o", destino],
        cwd: "/vercel",
      });
      if (resultado.exitCode !== 0) throw new Error(`Falha sincronizando ${arquivo}.`);
    }

    await sandbox.runCommand({
      cmd: "node",
      args: [SCRIPT_PATH, "CONFIRMAR"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_DATAFEED_API_KEY: datafeedKey,
        AWIN_PUBLISHER_ID: publisher,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        KABUM_AWIN_LIMITE_PRODUTOS: "80",
        KABUM_AWIN_DESCONTO_MINIMO: "10",
      },
      detached: true,
    });

    return NextResponse.json(
      {
        sucesso: true,
        iniciado: true,
        advertiser_id: 17729,
        publisher_id: Number(publisher),
        limite_produtos: 80,
        desconto_minimo_percentual: 10,
        sandbox: SANDBOX_NAME,
        commit_script: commit,
        iniciadoEm: new Date().toISOString(),
      },
      { status: 202 },
    );
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "1") return status(request);
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
