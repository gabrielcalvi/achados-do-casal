import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHAVE = "lauri-run-38e7a2f1";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== CHAVE) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET ausente." }, { status: 500 });
  }

  const url = new URL(
    "/api/admin/economize/awin/produtos/executar?loja=lauri-esporte",
    request.nextUrl.origin
  );

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${segredo}` },
    cache: "no-store",
  });

  const texto = await resposta.text();

  return new NextResponse(texto, {
    status: resposta.status,
    headers: { "Content-Type": "application/json" },
  });
}
