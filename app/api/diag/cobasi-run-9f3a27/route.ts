import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAVE = "cobasi-17870-48117-test";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("k") !== CHAVE) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return NextResponse.json({ sucesso: false, erro: "CRON_SECRET ausente." }, { status: 500 });

  const resposta = await fetch(`${request.nextUrl.origin}/api/admin/economize/awin/cobasi/produtos/executar`, {
    headers: { Authorization: `Bearer ${segredo}` },
    cache: "no-store",
  });
  const texto = await resposta.text();
  return new NextResponse(texto, { status: resposta.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
