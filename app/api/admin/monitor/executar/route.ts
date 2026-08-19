import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monitorarProdutosAutomaticamente } from "@/lib/services/automaticPriceMonitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 24;

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() ?? "";

  if (!segredo) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(request: NextRequest) {
  if (autorizadoComoCron(request)) {
    return true;
  }

  return usuarioAutenticado();
}

function obterLimite(request: NextRequest) {
  const valor = Number(request.nextUrl.searchParams.get("limite") || LIMITE_PADRAO);

  if (!Number.isFinite(valor)) {
    return LIMITE_PADRAO;
  }

  return Math.max(1, Math.min(LIMITE_MAXIMO, Math.trunc(valor)));
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nao autorizado.",
      },
      { status: 401 }
    );
  }

  try {
    const limite = obterLimite(request);
    const inicio = Date.now();
    const resultado = await monitorarProdutosAutomaticamente(limite);

    return NextResponse.json({
      sucesso: true,
      duracao_ms: Date.now() - inicio,
      ...resultado,
    });
  } catch (erro) {
    console.error("[MONITOR AUTOMATICO] Falha na rodada:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro desconhecido ao executar o monitor automatico.",
      },
      { status: 500 }
    );
  }
}
