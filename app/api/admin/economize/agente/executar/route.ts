import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LojaAtiva = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
};

function obterMensagemErro(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado durante a execução do agente.";
}

export async function POST() {
  let execucaoId: string | null = null;

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

    const {
      data: execucaoCriada,
      error: erroCriacao,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .insert({
        loja_id: null,
        status: "executando",
        detalhes: {
          tipo: "teste_manual",
          origem: "painel_administrativo",
          etapa: "inicializacao",
          usuario_id: user.id,
        },
      })
      .select(
        `
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
          created_at
        `
      )
      .single();

    if (erroCriacao || !execucaoCriada) {
      console.error(
        "Erro ao criar execução do Agente de Economia:",
        erroCriacao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível iniciar a execução do agente.",
        },
        {
          status: 500,
        }
      );
    }

    execucaoId = execucaoCriada.id;

    const {
      data: lojas,
      error: erroLojas,
    } = await supabaseAdmin
      .from("economize_lojas")
      .select("id, nome, slug, ordem")
      .eq("ativa", true)
      .order("ordem", {
        ascending: true,
      });

    if (erroLojas) {
      throw new Error(
        `Não foi possível consultar as lojas ativas: ${erroLojas.message}`
      );
    }

    const lojasAtivas =
      (lojas ?? []) as LojaAtiva[];

    const finalizadoEm =
      new Date().toISOString();

    const {
      data: execucaoFinalizada,
      error: erroFinalizacao,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .update({
        status: "concluida",
        ofertas_encontradas: 0,
        ofertas_novas: 0,
        ofertas_atualizadas: 0,
        ofertas_desativadas: 0,
        total_erros: 0,
        finalizado_em: finalizadoEm,
        mensagem_erro: null,
        detalhes: {
          tipo: "teste_manual",
          origem: "painel_administrativo",
          etapa: "finalizada",
          usuario_id: user.id,
          lojas_ativas: lojasAtivas.length,
          lojas: lojasAtivas.map((loja) => ({
            id: loja.id,
            nome: loja.nome,
            slug: loja.slug,
            ordem: loja.ordem,
          })),
          mensagem:
            "Motor inicial do Agente de Economia executado com sucesso.",
        },
      })
      .eq("id", execucaoId)
      .select(
        `
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
          created_at
        `
      )
      .single();

    if (
      erroFinalizacao ||
      !execucaoFinalizada
    ) {
      throw new Error(
        erroFinalizacao?.message ||
          "Não foi possível finalizar o histórico da execução."
      );
    }

    return NextResponse.json({
      mensagem:
        "Execução de teste concluída com sucesso.",
      execucao: execucaoFinalizada,
    });
  } catch (error) {
    const mensagemErro =
      obterMensagemErro(error);

    console.error(
      "Erro no Agente de Economia:",
      error
    );

    if (execucaoId) {
      const { error: erroRegistro } =
        await supabaseAdmin
          .from("economize_execucoes")
          .update({
            status: "erro",
            total_erros: 1,
            finalizado_em:
              new Date().toISOString(),
            mensagem_erro: mensagemErro,
            detalhes: {
              tipo: "teste_manual",
              origem: "painel_administrativo",
              etapa: "erro",
              mensagem: mensagemErro,
            },
          })
          .eq("id", execucaoId);

      if (erroRegistro) {
        console.error(
          "Erro ao registrar falha da execução:",
          erroRegistro
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "A execução do agente não foi concluída.",
        detalhes: mensagemErro,
      },
      {
        status: 500,
      }
    );
  }
}