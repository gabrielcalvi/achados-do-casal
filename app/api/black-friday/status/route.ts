import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LojaRelacionada = {
  id?: string;
  nome?: string;
  slug?: string;
  ativa?: boolean;
};

type CupomAtivo = {
  id: string;
  loja_id: string;
  desconto_percentual: number | string | null;
  valor_desconto: number | string | null;
  created_at: string;
  updated_at: string;
  verificado_em: string | null;
  loja: LojaRelacionada | LojaRelacionada[] | null;
};

function normalizarLoja(
  loja: LojaRelacionada | LojaRelacionada[] | null,
): LojaRelacionada | null {
  if (Array.isArray(loja)) return loja[0] ?? null;
  return loja ?? null;
}

function proximaExecucaoRadar(agora: Date) {
  const proxima = new Date(agora);
  proxima.setUTCSeconds(0, 0);
  proxima.setUTCMinutes(25);
  proxima.setUTCHours(Math.floor(proxima.getUTCHours() / 3) * 3);

  if (proxima.getTime() <= agora.getTime()) {
    proxima.setUTCHours(proxima.getUTCHours() + 3);
  }

  return proxima.toISOString();
}

export async function GET() {
  try {
    const agora = new Date();
    const agoraIso = agora.toISOString();
    const ultimas24Horas = new Date(
      agora.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: ativos, error: erroAtivos } = await supabaseAdmin
      .from("economize_cupons")
      .select(
        `
          id,loja_id,desconto_percentual,valor_desconto,
          created_at,updated_at,verificado_em,
          loja:economize_lojas!inner(id,nome,slug,ativa)
        `,
      )
      .eq("status", "ativo")
      .eq("economize_lojas.ativa", true)
      .or(`data_inicio.is.null,data_inicio.lte.${agoraIso}`)
      .or(`validade.is.null,validade.gt.${agoraIso}`)
      .limit(5000);

    if (erroAtivos) {
      console.error("Erro ao carregar status do radar:", erroAtivos);
      return NextResponse.json(
        { error: "Não foi possível carregar o status do radar." },
        { status: 500 },
      );
    }

    const cupons = (ativos ?? []) as CupomAtivo[];
    const lojas = new Set<string>();
    let maiorPercentual = 0;
    let maiorValor = 0;
    let ultimaVerificacao: string | null = null;
    let novosUltimas24Horas = 0;

    for (const cupom of cupons) {
      const loja = normalizarLoja(cupom.loja);
      if (loja?.id) lojas.add(loja.id);

      maiorPercentual = Math.max(
        maiorPercentual,
        Number(cupom.desconto_percentual) || 0,
      );
      maiorValor = Math.max(maiorValor, Number(cupom.valor_desconto) || 0);

      if (new Date(cupom.created_at).getTime() >= new Date(ultimas24Horas).getTime()) {
        novosUltimas24Horas += 1;
      }

      const verificado = cupom.verificado_em || cupom.updated_at;
      if (
        verificado &&
        (!ultimaVerificacao ||
          new Date(verificado).getTime() >
            new Date(ultimaVerificacao).getTime())
      ) {
        ultimaVerificacao = verificado;
      }
    }

    const { count: retiradosUltimas24Horas, error: erroRetirados } =
      await supabaseAdmin
        .from("economize_cupons")
        .select("id", { count: "exact", head: true })
        .in("status", ["inativo", "expirado"])
        .gte("updated_at", ultimas24Horas);

    if (erroRetirados) {
      console.error("Erro ao contar cupons retirados:", erroRetirados);
    }

    return NextResponse.json(
      {
        cuponsAtivos: cupons.length,
        lojasComCupons: lojas.size,
        novosUltimas24Horas,
        retiradosUltimas24Horas: retiradosUltimas24Horas ?? 0,
        maiorPercentual,
        maiorValor,
        ultimaVerificacao,
        proximaExecucao: proximaExecucaoRadar(agora),
        frequenciaMinutos: 180,
        atualizadoEm: agoraIso,
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado no status do radar:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar o status do radar." },
      { status: 500 },
    );
  }
}
