import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: erroAutenticacao,
    } = await supabase.auth.getUser();

    if (erroAutenticacao || !user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const { data: lojas, error } = await supabaseAdmin
      .from("economize_lojas")
      .select(
        "id, nome, slug, dominio, logo_url, ativa, ordem"
      )
      .order("ordem", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Erro ao listar lojas da Central Economize:",
        error
      );

      return NextResponse.json(
        {
          error: "Não foi possível carregar as lojas.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      lojas: lojas ?? [],
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao carregar lojas:",
      error
    );

    return NextResponse.json(
      {
        error: "Erro interno ao carregar as lojas.",
      },
      {
        status: 500,
      }
    );
  }
}