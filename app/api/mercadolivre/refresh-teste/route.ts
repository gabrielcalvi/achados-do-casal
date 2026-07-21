import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const urlRefresh = new URL(
    "/api/mercadolivre/refresh",
    request.nextUrl.origin
  );

  const resposta = await fetch(urlRefresh, {
    method: "POST",
    cache: "no-store",
  });

  const dados = await resposta.json();

  return NextResponse.json(dados, {
    status: resposta.status,
  });
}