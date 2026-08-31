import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const ROTAS = [
  "/api/admin/economize/awin/produtos/executar",
  "/api/admin/economize/awin/nike/produtos/executar",
  "/api/admin/economize/awin/kabum/produtos/executar",
];

async function chamar(rota: string, segredo: string) {
  try {
    const resposta = await fetch(`https://achadosdocasal.com.br${rota}`, {
      headers: { Authorization: `Bearer ${segredo}` },
      cache: "no-store",
    });
    const texto = await resposta.text();
    let corpo: unknown = texto;
    try { corpo = JSON.parse(texto); } catch {}
    return { rota, http: resposta.status, corpo };
  } catch (erro) {
    return { rota, http: 0, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return NextResponse.json({ sucesso: false, erro: "CRON_SECRET ausente." }, { status: 500 });

  const modo = request.nextUrl.searchParams.get("modo") || "todos";

  if (modo === "cea-reset") {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-lc", "pkill -f 'varrer-produtos-awin-legacy-wrapper.cjs|varrer-produtos-awin-legacy-normalizado.cjs' || true"],
      cwd: "/vercel",
    });
    const resultado = await chamar(ROTAS[0], segredo);
    return NextResponse.json({ sucesso: resultado.http >= 200 && resultado.http < 300, modo, resultados: [resultado], disparadoEm: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  }

  const resultados = [];
  for (const rota of ROTAS) resultados.push(await chamar(rota, segredo));
  return NextResponse.json({ sucesso: resultados.every((item) => item.http >= 200 && item.http < 300), modo, resultados, disparadoEm: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
