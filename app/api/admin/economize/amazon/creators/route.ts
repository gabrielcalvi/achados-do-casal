import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  amazonCreatorsGetItems,
  amazonCreatorsStatusConfig,
  amazonCreatorsToken,
} from "@/lib/amazon/creatorsApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const config = amazonCreatorsStatusConfig();
  return NextResponse.json(
    {
      sucesso: true,
      config,
      pronto_para_teste: config.configurado,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const asin = String(body?.asin || "").trim().toUpperCase();

    if (!asin) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe um ASIN para testar." },
        { status: 400 }
      );
    }

    const config = amazonCreatorsStatusConfig();
    if (!config.configurado) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Creators API ainda nao configurada.",
          config,
        },
        { status: 400 }
      );
    }

    const token = await amazonCreatorsToken();
    const resultado = await amazonCreatorsGetItems([asin]);
    const item = resultado.itens[0] || null;

    return NextResponse.json({
      sucesso: true,
      autenticado: Boolean(token),
      asin,
      item,
      erros: resultado.erros,
      marketplace: config.marketplace,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Falha ao testar Creators API.",
      },
      { status: 500 }
    );
  }
}
