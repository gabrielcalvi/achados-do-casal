import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function usuarioAutenticado() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return !error && Boolean(user);
}

export async function POST(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Não autorizado." },
      { status: 401 }
    );
  }

  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    return NextResponse.json(
      { sucesso: false, erro: "CRON_SECRET não configurado." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const slug = String(body?.slug || "").trim();
    const mes = String(body?.mes || "").trim();
    const dia = Number(body?.dia || 0);
    const limite = Math.min(12, Math.max(1, Number(body?.limite || 3)));

    if (!slug) {
      return NextResponse.json(
        { sucesso: false, erro: "Selecione uma rota." },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe o mês no formato AAAA-MM." },
        { status: 400 }
      );
    }

    const url = new URL(
      "/api/admin/viagens/radar/executar",
      request.nextUrl.origin
    );
    url.searchParams.set("slug", slug);
    url.searchParams.set("modo", "caca");
    url.searchParams.set("mes", mes);
    url.searchParams.set("limite", String(limite));

    if (Number.isInteger(dia) && dia > 0) {
      url.searchParams.set("dia", String(dia));
    }

    const resposta = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${segredo}`,
      },
      cache: "no-store",
    });

    const texto = await resposta.text();
    let dados: any = {};

    try {
      dados = texto ? JSON.parse(texto) : {};
    } catch {
      dados = { texto };
    }

    return NextResponse.json(
      {
        sucesso: resposta.ok && dados?.sucesso === true,
        http: resposta.status,
        dados,
      },
      { status: resposta.ok ? 200 : resposta.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro inesperado.",
      },
      { status: 500 }
    );
  }
}
