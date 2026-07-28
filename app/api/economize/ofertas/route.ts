import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = new Set([
  "cupom",
  "cashback",
  "promocao",
  "campanha",
  "frete_gratis",
]);

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function GET(request: NextRequest) {
  try {
    const tipo =
      request.nextUrl.searchParams.get("tipo");

    const loja =
      request.nextUrl.searchParams.get("loja");

    if (tipo && !TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json(
        {
          error: "O tipo informado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (loja && !SLUG_REGEX.test(loja)) {
      return NextResponse.json(
        {
          error: "A loja informada não é válida.",
        },
        {
          status: 400,
        }
      );
    }

    const agora = new Date().toISOString();

    let consulta = supabaseAdmin
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
          ativa,
          ordem
        )
      `)
      .eq("status", "ativo")
      .eq("economize_lojas.ativa", true)
      .or(
        `data_inicio.is.null,data_inicio.lte.${agora}`
      )
      .or(
        `validade.is.null,validade.gt.${agora}`
      )
      .order("destaque", {
        ascending: false,
      })
      .order("updated_at", {
        ascending: false,
      });

    if (tipo) {
      consulta = consulta.eq("tipo", tipo);
    }

    if (loja) {
      consulta = consulta.eq(
        "economize_lojas.slug",
        loja
      );
    }

    const { data: ofertas, error } =
      await consulta;

    if (error) {
      console.error(
        "Erro ao carregar ofertas públicas:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar as oportunidades.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ofertas: ofertas ?? [],
        total: ofertas?.length ?? 0,
        atualizadoEm: agora,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Erro inesperado na Central Economize pública:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar as oportunidades.",
      },
      {
        status: 500,
      }
    );
  }
}