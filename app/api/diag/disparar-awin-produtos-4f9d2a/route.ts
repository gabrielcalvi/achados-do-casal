import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROTAS = [
  "/api/admin/economize/awin/produtos/executar",
  "/api/admin/economize/awin/nike/produtos/executar",
  "/api/admin/economize/awin/kabum/produtos/executar",
];

export async function GET() {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return NextResponse.json({ sucesso: false, erro: "CRON_SECRET ausente." }, { status: 500 });

  const resultados = [];
  for (const rota of ROTAS) {
    try {
      const resposta = await fetch(`https://achadosdocasal.com.br${rota}`, {
        headers: { Authorization: `Bearer ${segredo}` },
        cache: "no-store",
      });
      const texto = await resposta.text();
      let corpo: unknown = texto;
      try { corpo = JSON.parse(texto); } catch {}
      resultados.push({ rota, http: resposta.status, corpo });
    } catch (erro) {
      resultados.push({ rota, http: 0, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return NextResponse.json({ sucesso: resultados.every((item) => item.http >= 200 && item.http < 300), resultados, disparadoEm: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
