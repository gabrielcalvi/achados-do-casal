import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

async function lerTexto(sandbox: SandboxInstancia, caminho: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [caminho], cwd: "/vercel" });
  if (resultado.exitCode !== 0) return null;
  const texto = (await resultado.stdout()).trim();
  return texto || null;
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const texto = await lerTexto(sandbox, caminho);
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return { invalido: true, trecho: texto.slice(0, 500) }; }
}

export async function GET() {
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const [ps, ceaStatus, ceaResultado, ceaExit, nikeStatus, nikeResultado, kabumStatus, kabumResultado] = await Promise.all([
      sandbox.runCommand({ cmd: "ps", args: ["-eo", "pid=,etime=,args="], cwd: "/vercel" }),
      lerJson(sandbox, "/vercel/tmp/awin-produtos-status.json"),
      lerJson(sandbox, "/vercel/tmp/awin-produtos-resultado.json"),
      lerTexto(sandbox, "/vercel/tmp/awin-produtos-exit.txt"),
      lerJson(sandbox, "/vercel/tmp/awin-nike-produtos-status.json"),
      lerJson(sandbox, "/vercel/tmp/awin-nike-produtos-resultado.json"),
      lerJson(sandbox, "/vercel/tmp/awin-kabum-produtos-status.json"),
      lerJson(sandbox, "/vercel/tmp/awin-kabum-produtos-resultado.json"),
    ]);

    const processos = (await ps.stdout())
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => /varrer-produtos-awin/i.test(linha))
      .slice(0, 20);

    return NextResponse.json({
      sucesso: true,
      sandbox: SANDBOX_NAME,
      processos,
      cea: { status: ceaStatus, resultado: ceaResultado, exitCode: ceaExit },
      nike: { status: nikeStatus, resultado: nikeResultado },
      kabum: { status: kabumStatus, resultado: kabumResultado },
      consultadoEm: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    }, { status: 500 });
  }
}
