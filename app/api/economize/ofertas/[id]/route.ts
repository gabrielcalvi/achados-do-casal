import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_REGEX = /^[0-9a-f-]{20,64}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    if (!ID_REGEX.test(id)) {
      return NextResponse.json({ error: "Oferta invalida." }, { status: 400 });
    }

    const agora = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .select(`
        id,
        loja_id,
        tipo,
        titulo,
        descricao,
        codigo,
        categoria,
        regras,
        imagem_url,
        desconto_percentual,
        valor_desconto,
        cashback_percentual,
        pedido_minimo,
        preco_original,
        preco_oferta,
        data_inicio,
        validade,
        destaque,
        selos,
        origem,
        updated_at,
        loja:economize_lojas!inner (
          id,
          nome,
          slug,
          dominio,
          logo_url,
          ativa
        )
      `)
      .eq("id", id)
      .eq("status", "ativo")
      .eq("economize_lojas.ativa", true)
      .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
      .or(`validade.is.null,validade.gt.${agora}`)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar oferta individual:", error);
      return NextResponse.json({ error: "Nao foi possivel carregar a oferta." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Oferta nao encontrada ou indisponivel." }, { status: 404 });
    }

    return NextResponse.json(
      { oferta: data, atualizadoEm: agora },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Erro inesperado na oferta individual:", error);
    return NextResponse.json({ error: "Erro interno ao carregar a oferta." }, { status: 500 });
  }
}
