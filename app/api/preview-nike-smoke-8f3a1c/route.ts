import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const BASE_DIR = "/vercel/scripts";
const TMP_DIR = "/vercel/tmp";
const LEGACY = `${BASE_DIR}/varrer-produtos-awin-legacy.cjs`;
const NIKE = `${BASE_DIR}/varrer-produtos-awin-nike-seguro.cjs`;
const CONFIG = `${BASE_DIR}/awin-lojas.config.cjs`;
const STATUS = `${TMP_DIR}/awin-nike-produtos-status.json`;
const RESULT = `${TMP_DIR}/awin-nike-produtos-resultado.json`;

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

function permitido() {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "feature/nike-awin-vitrine"
  );
}

async function comando(
  sandbox: SandboxInstancia,
  cmd: string,
  args: string[],
  env?: Record<string, string>
) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel", env });
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();
  return { resultado, stdout, stderr };
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const leitura = await comando(sandbox, "cat", [caminho]);
  if (leitura.resultado.exitCode !== 0 || !leitura.stdout) return null;
  try {
    return JSON.parse(leitura.stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!permitido()) {
    return NextResponse.json({ sucesso: false, erro: "Disponivel somente no preview da branch Nike." }, { status: 404 });
  }

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

    if (request.nextUrl.searchParams.get("status") === "1") {
      const dados = (await lerJson(sandbox, STATUS)) || (await lerJson(sandbox, RESULT));
      return NextResponse.json({ sucesso: true, status: dados || { executando: false, mensagem: "sem_status" } });
    }

    await comando(sandbox, "mkdir", ["-p", BASE_DIR, TMP_DIR]);

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos: Array<[string, string]> = [
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`, LEGACY],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-nike-seguro.cjs`, NIKE],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`, CONFIG],
    ];

    for (const [url, destino] of arquivos) {
      const download = await comando(sandbox, "curl", ["-fsSL", "--max-time", "30", url, "-o", destino]);
      if (download.resultado.exitCode !== 0) {
        throw new Error(download.stderr || `Falha sincronizando ${destino}.`);
      }
    }

    await comando(sandbox, "rm", ["-f", STATUS, RESULT]);

    await sandbox.runCommand({
      cmd: "node",
      args: [NIKE, "CONFIRMAR"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_DATAFEED_API_KEY: datafeedKey,
        AWIN_PUBLISHER_ID: publisher,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        NIKE_AWIN_LIMITE_PRODUTOS: "16",
        NIKE_AWIN_DESCONTO_MINIMO: "10",
        NIKE_AWIN_OBSERVACAO_HORAS: "24",
      },
      detached: true,
    });

    return NextResponse.json({
      sucesso: true,
      iniciado: true,
      sandbox: SANDBOX_NAME,
      commit,
      modo: "nike_seguro_preview",
      observacao_horas: 24,
      limite: 16,
      desconto_minimo: 10,
    }, { status: 202 });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    }, { status: 500 });
  }
}
