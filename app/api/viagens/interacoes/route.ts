import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "viagens_session";
const EVENTOS = new Set(["origem_selecionada", "destino_selecionado", "busca_orcamento", "outra_origem_interesse"]);

function texto(valor: unknown, limite = 200) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) || null : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const evento = texto(body?.evento, 60);

    if (!evento || !EVENTOS.has(evento)) {
      return NextResponse.json({ sucesso: false, erro: "Evento inválido." }, { status: 400 });
    }

    const recebida = request.cookies.get(COOKIE)?.value || "";
    const sessionId = /^[0-9a-f-]{36}$/i.test(recebida) ? recebida : randomUUID();

    const { error } = await supabaseAdmin.from("viagens_interacoes").insert({
      evento,
      origem_codigo: texto(body?.origem, 20),
      destino_codigo: texto(body?.destino, 20),
      detalhe: texto(body?.detalhe, 200),
      session_id: sessionId,
      referer: texto(request.headers.get("referer"), 1000),
      user_agent: texto(request.headers.get("user-agent"), 1000),
    });

    if (error) throw new Error(error.message);

    const resposta = NextResponse.json({ sucesso: true });
    if (!recebida) {
      resposta.cookies.set({
        name: COOKIE,
        value: sessionId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return resposta;
  } catch (error) {
    console.error("[Viagens interacoes]", error);
    return NextResponse.json({ sucesso: false }, { status: 500 });
  }
}
