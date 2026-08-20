import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const STATUS_PATH = "/vercel/tmp/awin-produtos-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-resultado.json";
const LOG_PATH = "/vercel/tmp/awin-produtos.log";
const EXIT_PATH = "/vercel/tmp/awin-produtos-exit.txt";

async function lerTexto(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, caminho: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [caminho], cwd: "/vercel" });
  if (resultado.exitCode !== 0) return null;
  const texto = (await resultado.stdout()).trim();
  return texto || null;
}

async function lerJson(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, caminho: string) {
  const texto = await lerTexto(sandbox, caminho);
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return { bruto: texto.slice(0, 2000) }; }
}

export async function GET() {
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const [status, resultado, log, exitCode] = await Promise.all([
      lerJson(sandbox, STATUS_PATH),
      lerJson(sandbox, RESULT_PATH),
      lerTexto(sandbox, LOG_PATH),
      lerTexto(sandbox, EXIT_PATH),
    ]);
    const ps = await sandbox.runCommand({ cmd: "ps", args: ["-eo", "pid=,args="], cwd: "/vercel" });
    const processos = (await ps.stdout())
      .split("\n")
      .filter((linha) => /varrer-produtos-awin-legacy|varrer-produtos-awin-legacy-wrapper/.test(linha))
      .slice(0, 10);
    return NextResponse.json({
      sucesso: true,
      status,
      resultado,
      exitCode,
      log: log?.slice(-5000) || null,
      processos,
    });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}
