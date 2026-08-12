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
      data: menores,
      error: erroMenores,
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
          "preco_por_pessoa",
          {
            ascending:
              true,
          }
        )
        .order(
          "observado_em",
          {
            ascending:
              false,
          }
        )
        .limit(100);

    if (erroMenores) {
      throw new Error(
        erroMenores.message
      );
    }

    const unicas =
      new Map<
        string,
        any
      >();

    for (
      const item of
      menores || []
    ) {
      const chave =
        `${item.ida}|${item.volta}`;

      if (
        !unicas.has(
          chave
        )
      ) {
        unicas.set(
          chave,
          item
        );
      }

      if (
        unicas.size >= 5
      ) {
        break;
      }
    }

    const melhores =
      Array.from(
        unicas.values()
      ).map(
        normalizarOferta
      );

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