import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  mensagemErroProcessamentoMercadoLivre,
  processarFonteMercadoLivre,
  type FonteMercadoLivre,
} from "@/lib/economize/processadores/mercadoLivre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FonteEncontrada = {
  id: string;
  loja_id: string;
  nome: string;
  url: string | null;
  ativa: boolean;
  prioridade: number;
  intervalo_minutos: number;
};

export async function POST() {
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
      data: fonteEncontrada,
      error: erroFonte,
    } = await supabaseAdmin
      .from("economize_fontes")
      .select(`
        id,
        loja_id,
        nome,
        url,
        ativa,
        prioridade,
        intervalo_minutos
      `)
      .eq("ativa", true)
      .ilike(
        "url",
        "%mercadolivre.com.br/ofertas%"
      )
      .order("prioridade", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (erroFonte) {
      console.error(
        "Erro ao localizar fonte do Mercado Livre:",
        erroFonte
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível localizar a fonte do Mercado Livre.",
        },
        {
          status: 500,
        }
      );
    }

    const fonte =
      fonteEncontrada as FonteEncontrada | null;

    if (!fonte) {
      return NextResponse.json(
        {
          error:
            "Nenhuma fonte ativa do Mercado Livre foi encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    if (!fonte.url) {
      return NextResponse.json(
        {
          error:
            "A fonte do Mercado Livre não possui uma URL cadastrada.",
        },
        {
          status: 400,
        }
      );
    }

    const fonteProcessamento: FonteMercadoLivre = {
      id: fonte.id,
      loja_id: fonte.loja_id,
      nome: fonte.nome,
      url: fonte.url,
      ativa: fonte.ativa,
      prioridade: fonte.prioridade,
      intervalo_minutos:
        fonte.intervalo_minutos,
    };

    const resultado =
      await processarFonteMercadoLivre(
        fonteProcessamento
      );

    const agora =
      new Date().toISOString();

    const proximaExecucaoEm = new Date(
      Date.now() +
        fonte.intervalo_minutos *
          60 *
          1000
    ).toISOString();

    const {
      error: erroAtualizacaoFonte,
    } = await supabaseAdmin
      .from("economize_fontes")
      .update({
        ultima_execucao_em: agora,
        proxima_execucao_em:
          proximaExecucaoEm,
        updated_at: agora,
      })
      .eq("id", fonte.id);

    if (erroAtualizacaoFonte) {
      console.error(
        "Erro ao atualizar datas da fonte:",
        erroAtualizacaoFonte
      );
    }

    return NextResponse.json({
      mensagem:
        resultado.total_erros > 0
          ? "Processamento concluído com alguns erros."
          : "Mercado Livre processado com sucesso.",

      fonte: {
        id: fonte.id,
        loja_id: fonte.loja_id,
        nome: fonte.nome,
        url: fonte.url,
      },

      resultado,

      fonte_atualizada:
        !erroAtualizacaoFonte,

      aviso:
        erroAtualizacaoFonte
          ? "As ofertas foram processadas, mas as datas da fonte não foram atualizadas."
          : null,
    });
  } catch (error) {
    const mensagem =
      mensagemErroProcessamentoMercadoLivre(
        error
      );

    console.error(
      "Erro ao processar Mercado Livre:",
      error
    );

    return NextResponse.json(
      {
        error:
          "O processamento do Mercado Livre não foi concluído.",
        detalhes: mensagem,
      },
      {
        status: 500,
      }
    );
  }
}