import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RADAR_PADRAO =
  "poa-orlando";

const RADARES_PUBLICOS =
  new Set([
    "poa-orlando",
    "poa-new-york",
    "poa-miami",
    "poa-los-angeles",
    "poa-lisboa",

    "gru-orlando",
    "gru-new-york",
    "gru-miami",
    "gru-los-angeles",
    "gru-lisboa",
    "gru-madrid",

    "gig-orlando",
    "gig-new-york",
    "gig-miami",
    "gig-los-angeles",
    "gig-lisboa",
  ]);

function criarSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server-side nao configurado."
    );
  }

  return createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function textoFaixa(
  faixa: string
) {
  const mapa:
    Record<
      string,
      {
        titulo: string;
        emoji: string;
      }
    > = {
      achado_absurdo: {
        titulo:
          "Achado absurdo",
        emoji:
          "🔥",
      },

      preco_bom: {
        titulo:
          "Preço bom",
        emoji:
          "🟢",
      },

      interessante: {
        titulo:
          "Interessante",
        emoji:
          "🟡",
      },

      preco_comum: {
        titulo:
          "Preço comum",
        emoji:
          "⚪",
      },

      nao_promocao: {
        titulo:
          "Não é promoção",
        emoji:
          "❌",
      },
    };

  return (
    mapa[faixa] || {
      titulo:
        faixa,
      emoji:
        "✈️",
    }
  );
}

function mediana(
  valores: number[]
) {
  if (!valores.length) {
    return 0;
  }

  const ordenados =
    [...valores].sort(
      (
        a,
        b
      ) =>
        a - b
    );

  const meio =
    Math.floor(
      ordenados.length / 2
    );

  if (
    ordenados.length %
      2 ===
    1
  ) {
    return ordenados[
      meio
    ];
  }

  return (
    ordenados[
      meio - 1
    ] +
    ordenados[
      meio
    ]
  ) / 2;
}

function chaveMes(
  data: unknown
) {
  return String(
    data || ""
  ).slice(
    0,
    7
  );
}


function normalizarOferta(
  item: any
) {
  const faixa =
    textoFaixa(
      String(
        item.faixa || ""
      )
    );

  const bruto =
    item.dados_brutos &&
    typeof item.dados_brutos ===
      "object"
      ? item.dados_brutos
      : {};

  return {
    ida:
      item.ida,

    volta:
      item.volta,

    permanenciaDias:
      Number(
        item.permanencia_dias
      ),

    moeda:
      item.moeda ||
      "BRL",

    precoPorPessoa:
      Number(
        item.preco_por_pessoa
      ),

    faixa:
      item.faixa,

    tituloFaixa:
      faixa.titulo,

    emojiFaixa:
      faixa.emoji,

    companhia:
      bruto.companhia ||
      bruto.carrier ||
      null,

    observadoEm:
      item.observado_em,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const radarSlug =
      request.nextUrl.searchParams
        .get("slug")
        ?.trim() ||
      RADAR_PADRAO;

    if (
      !RADARES_PUBLICOS.has(
        radarSlug
      )
    ) {
      return NextResponse.json(
        {
          sucesso: false,
          erro:
            "Radar nao encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const supabase =
      criarSupabase();

    const {
      data: radar,
      error: erroRadar,
    } =
      await supabase
        .from(
          "viagens_radares"
        )
        .select(`
          id,
          slug,
          nome,
          origem_codigo,
          destino_codigo,
          preco_excelente_ate,
          preco_muito_bom_ate,
          preco_interessante_ate,
          preco_comum_ate
        `)
        .eq(
          "slug",
          radarSlug
        )
        .single();

    if (erroRadar) {
      throw new Error(
        erroRadar.message
      );
    }

    const {
      count: totalObservacoes,
      error: erroContagem,
    } =
      await supabase
        .from(
          "viagens_precos"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "radar_id",
          radar.id
        )
        .eq(
          "provider",
          "ignav"
        );

    if (erroContagem) {
      throw new Error(
        erroContagem.message
      );
    }

    const {
      data: ultima,
      error: erroUltima,
    } =
      await supabase
        .from(
          "viagens_precos"
        )
        .select(`
          observado_em
        `)
        .eq(
          "radar_id",
          radar.id
        )
        .eq(
          "provider",
          "ignav"
        )
        .order(
          "observado_em",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (erroUltima) {
      throw new Error(
        erroUltima.message
      );
    }

    const {
      data:
        historicoMensalRaw,
      error:
        erroHistoricoMensal,
    } =
      await supabase
        .from(
          "viagens_precos"
        )
        .select(`
          ida,
          volta,
          permanencia_dias,
          moeda,
          preco_por_pessoa,
          faixa,
          observado_em,
          dados_brutos
        `)
        .eq(
          "radar_id",
          radar.id
        )
        .eq(
          "provider",
          "ignav"
        )
        .order(
          "observado_em",
          {
            ascending:
              false,
          }
        )
        .limit(
          1000
        );

    if (
      erroHistoricoMensal
    ) {
      throw new Error(
        erroHistoricoMensal
          .message
      );
    }

    const registros =
      (
        historicoMensalRaw ||
        []
      ).filter(
        (
          item: any
        ) => {
          const preco =
            Number(
              item
                .preco_por_pessoa
            );

          return (
            Number.isFinite(
              preco
            ) &&
            preco > 0 &&
            chaveMes(
              item.ida
            ).length ===
              7
          );
        }
      );

    const hoje =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );

    const futuros =
      registros.filter(
        (
          item: any
        ) =>
          String(
            item.ida
          ) >= hoje
      );

    const melhorPorMes =
      new Map<
        string,
        any
      >();

    const valoresPorMes =
      new Map<
        string,
        number[]
      >();

    for (
      const item of registros
    ) {
      const mes =
        chaveMes(
          item.ida
        );

      const preco =
        Number(
          item
            .preco_por_pessoa
        );

      const lista =
        valoresPorMes.get(
          mes
        ) || [];

      lista.push(
        preco
      );

      valoresPorMes.set(
        mes,
        lista
      );
    }

    for (
      const item of futuros
    ) {
      const mes =
        chaveMes(
          item.ida
        );

      const atual =
        melhorPorMes.get(
          mes
        );

      const preco =
        Number(
          item
            .preco_por_pessoa
        );

      const precoAtual =
        atual
          ? Number(
              atual
                .preco_por_pessoa
            )
          : Infinity;

      const atualizacaoAtual =
        atual
          ? new Date(
              atual
                .observado_em
            ).getTime()
          : 0;

      const atualizacaoNova =
        new Date(
          item.observado_em
        ).getTime();

      if (
        !atual ||
        preco <
          precoAtual ||
        (
          preco ===
            precoAtual &&
          atualizacaoNova >
            atualizacaoAtual
        )
      ) {
        melhorPorMes.set(
          mes,
          item
        );
      }
    }

    const melhores =
      Array.from(
        melhorPorMes.values()
      )
        .sort(
          (
            a: any,
            b: any
          ) =>
            Number(
              a
                .preco_por_pessoa
            ) -
              Number(
                b
                  .preco_por_pessoa
              ) ||
            String(
              b.observado_em
            ).localeCompare(
              String(
                a.observado_em
              )
            )
        )
        .slice(
          0,
          5
        )
        .map(
          normalizarOferta
        );

    const resumoMensal =
      Array.from(
        valoresPorMes.entries()
      )
        .map(
          (
            [
              mes,
              valores,
            ]
          ) => ({
            mes,

            minimo:
              Number(
                Math.min(
                  ...valores
                ).toFixed(
                  2
                )
              ),

            mediana:
              Number(
                mediana(
                  valores
                ).toFixed(
                  2
                )
              ),

            observacoes:
              valores.length,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            a.mediana -
              b.mediana ||
            a.minimo -
              b.minimo
        );

    const mesesComAmostra =
      resumoMensal.filter(
        (
          item
        ) =>
          item.observacoes >=
          3
      );

    const historicoMensalSuficiente =
      mesesComAmostra.length >=
      3;

    const mesMaisBarato =
      historicoMensalSuficiente
        ? mesesComAmostra[0]
        : null;

    const melhor =
      melhores[0] ||
      null;

    return NextResponse.json(
      {
        sucesso:
          true,

        radar: {
          slug:
            radar.slug,

          nome:
            radar.nome,

          origem:
            radar.origem_codigo,

          destino:
            radar.destino_codigo,

          regua: {
            achadoAbsurdoAte:
              Number(
                radar.preco_excelente_ate
              ),

            precoBomAte:
              Number(
                radar.preco_muito_bom_ate
              ),

            interessanteAte:
              Number(
                radar.preco_interessante_ate
              ),

            precoComumAte:
              Number(
                radar.preco_comum_ate
              ),
          },
        },

        observacoes:
          totalObservacoes || 0,

        ultimaAtualizacao:
          ultima?.observado_em ||
          null,

        melhor,

        melhores,

        historicoMensal: {
          suficiente:
            historicoMensalSuficiente,

          mesMaisBarato,

          meses:
            resumoMensal.slice(
              0,
              12
            ),
        },
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso:
          false,

        erro:
          erro instanceof Error
            ? erro.message
            : String(
                erro
              ),
      },
      {
        status:
          500,
      }
    );
  }
}