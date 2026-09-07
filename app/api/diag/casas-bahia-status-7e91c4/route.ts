import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const STATUS_PATH = "/vercel/tmp/awin-produtos-casas-bahia-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-casas-bahia-resultado.json";
const LOG_PATH = "/vercel/tmp/awin-produtos-casas-bahia.log";
const EXIT_PATH = "/vercel/tmp/awin-produtos-casas-bahia-exit.txt";

async function ler(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, path: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [path], cwd: "/vercel" });
  const stdout = (await resultado.stdout()).trim();
  return resultado.exitCode === 0 ? stdout : null;
}

async function candidatosFeeds() {
  const chave = process.env.AWIN_DATAFEED_API_KEY?.trim();
  if (!chave) return { erro: "AWIN_DATAFEED_API_KEY ausente", candidatos: [] };

  const resposta = await fetch(
    `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(chave)}`,
    {
      cache: "no-store",
      headers: { Accept: "text/csv,text/plain,*/*" },
      signal: AbortSignal.timeout(30000),
    }
  );

  const texto = await resposta.text();
  if (!resposta.ok) {
    return { erro: `HTTP ${resposta.status}`, candidatos: [] };
  }

  const linhas = texto.split(/\r?\n/).filter(Boolean);
  const cabecalho = linhas[0] || "";
  const termos = /casas\s*bahia|casasbahia|grupo\s*casas\s*bahia|via\s*varejo|banqi|extra\.com|pontofrio|ponto\s*frio/i;
  const candidatos = linhas
    .slice(1)
    .filter((linha) => termos.test(linha))
    .slice(0, 50);

  return {
    total_linhas: Math.max(0, linhas.length - 1),
    cabecalho,
    candidatos,
  };
}

export async function GET() {
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const [statusRaw, resultRaw, logRaw, exitRaw, feeds] = await Promise.all([
      ler(sandbox, STATUS_PATH),
      ler(sandbox, RESULT_PATH),
      ler(sandbox, LOG_PATH),
      ler(sandbox, EXIT_PATH),
      candidatosFeeds(),
    ]);

    const parse = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    };

    return NextResponse.json({
      sucesso: true,
      status: parse(statusRaw),
      resultado: parse(resultRaw),
      exit: exitRaw,
      log: logRaw ? logRaw.slice(-12000) : null,
      feeds,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}
