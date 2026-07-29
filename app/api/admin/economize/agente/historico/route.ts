import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 50;

function obterLimite(request: NextRequest) {
  const valorRecebido =
    request.nextUrl.searchParams.get("limite");

  if (!valorRecebido) {
    return LIMITE_PADRAO;
  }

  const limite = Number.parseInt(
    valorRecebido,
    10
  );

  if (
    !Number.isInteger(limite) ||
    limite < 1
  ) {
    return LIMITE_PADRAO;
  }

  return Math.min(limite, LIMITE_MAXIMO);
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const limite = obterLimite(request);

    const {
      data: execucoes,
      error,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .select(`
        id,
        loja_id,
        status,
        ofertas_encontradas,
        ofertas_novas,
        ofertas_atualizadas,
        ofertas_desativadas,
        total_erros,
        iniciado_em,
        finalizado_em,
        mensagem_erro,
        detalhes,
        created_at,
        loja:economize_lojas (
          id,
          nome,
          slug
        )
      `)
      .order("iniciado_em", {
        ascending: false,
      })
      .limit(limite);

    if (error) {
      console.error(
        "Erro ao carregar histórico do Agente de Economia:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar o histórico do agente.",
        },
        {
          status: 500,
        }
      );
    }

    const historico = (execucoes ?? []).map(
      (execucao) => {
        const lojaRelacionada =
          Array.isArray(execucao.loja)
            ? execucao.loja[0] ?? null
            : execucao.loja ?? null;

        return {
          id: execucao.id,
          loja_id: execucao.loja_id,
          status: execucao.status,
          ofertas_encontradas:
            execucao.ofertas_encontradas,
          ofertas_novas:
            execucao.ofertas_novas,
          ofertas_atualizadas:
            execucao.ofertas_atualizadas,
          ofertas_desativadas:
            execucao.ofertas_desativadas,
          total_erros:
            execucao.total_erros,
          iniciado_em:
            execucao.iniciado_em,
          finalizado_em:
            execucao.finalizado_em,
          mensagem_erro:
            execucao.mensagem_erro,
          detalhes:
            execucao.detalhes ?? {},
          created_at:
            execucao.created_at,
          loja: lojaRelacionada,
        };
      }
    );

    return NextResponse.json(
      {
        execucoes: historico,
        total: historico.length,
        limite,
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
      "Erro inesperado ao carregar histórico do agente:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar o histórico do agente.",
      },
      {
        status: 500,
      }
    );
  }
}