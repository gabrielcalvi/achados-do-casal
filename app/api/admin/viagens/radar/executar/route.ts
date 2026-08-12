import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IGNAV_BASE_URL =
  "https://ignav.com/api";

const RADAR_PADRAO =
  "poa-orlando";

type RotaProvider = {
  origemProvider: string;
  destinoProvider: string;
};

const ROTAS:
  Record<
    string,
    RotaProvider
  > = {
  "poa-orlando": {
    origemProvider: "POA",
    destinoProvider: "MCO",
  },

  "poa-new-york": {
    origemProvider: "POA",
    destinoProvider: "JFK",
  },

  "poa-miami": {
    origemProvider: "POA",
    destinoProvider: "MIA",
  },

  "poa-los-angeles": {
    origemProvider: "POA",
    destinoProvider: "LAX",
  },

  "poa-lisboa": {
    origemProvider: "POA",
    destinoProvider: "LIS",
  },
};

const PERMANENCIAS =
  [8, 9, 10, 11, 12];

const LIMITE_PADRAO =
  6;

const LIMITE_MAXIMO =
  12;

type RadarDb = {
  id: string;
  slug: string;
  nome: string;
  origem_codigo: string;
  destino_codigo: string;
  preco_excelente_ate: number;
  preco_muito_bom_ate: number;
  preco_interessante_ate: number;
  preco_comum_ate: number;
};

type Combinacao = {
  ida: string;
  volta: string;
  permanencia: number;
};

type ObservacaoAnterior = {
  ida: string;
  volta: string;
  preco_por_pessoa: number;
  observado_em: string;
};

type Classificacao = {
  faixa:
    | "achado_absurdo"
    | "preco_bom"
    | "interessante"
    | "preco_comum"
    | "nao_promocao";

  titulo: string;
  prioridade: number;
};

function autorizado(
  request: NextRequest
) {
  const segredo =
    process.env.CRON_SECRET?.trim();

  if (!segredo) {
    return false;
  }

  return (
    request.headers.get(
      "authorization"
    ) ===
    `Bearer ${segredo}`
  );
}

function adicionarDias(
  data: string,
  dias: number
) {
  const valor =
    new Date(
      `${data}T00:00:00Z`
    );

  valor.setUTCDate(
    valor.getUTCDate() + dias
  );

  return valor
    .toISOString()
    .slice(0, 10);
}

function dataIso(
  ano: number,
  mes: number,
  dia: number
) {
  return new Date(
    Date.UTC(
      ano,
      mes - 1,
      dia
    )
  )
    .toISOString()
    .slice(0, 10);
}

function diasNoMes(
  ano: number,
  mes: number
) {
  return new Date(
    Date.UTC(
      ano,
      mes,
      0
    )
  ).getUTCDate();
}

function gerarCombinacoes() {
  const meses = [
    {
      ano: 2026,
      mes: 9,
    },
    {
      ano: 2027,
      mes: 3,
    },
  ];

  const combinacoes: Combinacao[] =
    [];

  for (const periodo of meses) {
    const totalDias =
      diasNoMes(
        periodo.ano,
        periodo.mes
      );

    for (
      let dia = 1;
      dia <= totalDias;
      dia += 1
    ) {
      const ida =
        dataIso(
          periodo.ano,
          periodo.mes,
          dia
        );

      for (
        const permanencia of
        PERMANENCIAS
      ) {
        combinacoes.push({
          ida,

          volta:
            adicionarDias(
              ida,
              permanencia
            ),

          permanencia,
        });
      }
    }
  }

  return combinacoes;
}

function chaveCombinacao(
  ida: string,
  volta: string
) {
  return `${ida}|${volta}`;
}

function classificar(
  radar: RadarDb,
  preco: number
): Classificacao {
  if (
    preco <=
    Number(
      radar.preco_excelente_ate
    )
  ) {
    return {
      faixa:
        "achado_absurdo",

      titulo:
        "Achado absurdo",

      prioridade:
        4,
    };
  }

  if (
    preco <=
    Number(
      radar.preco_muito_bom_ate
    )
  ) {
    return {
      faixa:
        "preco_bom",

      titulo:
        "Preco bom",

      prioridade:
        3,
    };
  }

  if (
    preco <=
    Number(
      radar.preco_interessante_ate
    )
  ) {
    return {
      faixa:
        "interessante",

      titulo:
        "Interessante dependendo da data",

      prioridade:
        2,
    };
  }

  if (
    preco <=
    Number(
      radar.preco_comum_ate
    )
  ) {
    return {
      faixa:
        "preco_comum",

      titulo:
        "Preco comum",

      prioridade:
        1,
    };
  }

  return {
    faixa:
      "nao_promocao",

    titulo:
      "Nao e promocao",

    prioridade:
      0,
  };
}

function media(
  valores: number[]
) {
  if (!valores.length) {
    return null;
  }

  return (
    valores.reduce(
      (total, valor) =>
        total + valor,
      0
    ) /
    valores.length
  );
}

function percentualAbaixo(
  preco: number,
  referencia: number | null
) {
  if (
    referencia === null ||
    referencia <= 0
  ) {
    return null;
  }

  return (
    (
      referencia -
      preco
    ) /
    referencia
  ) * 100;
}

function selecionarCombinacoes(
  todas: Combinacao[],
  anteriores: ObservacaoAnterior[],
  limite: number
) {
  const ultimaPorCombinacao =
    new Map<
      string,
      ObservacaoAnterior
    >();

  for (
    const observacao of anteriores
  ) {
    const chave =
      chaveCombinacao(
        observacao.ida,
        observacao.volta
      );

    const atual =
      ultimaPorCombinacao.get(
        chave
      );

    if (
      !atual ||
      new Date(
        observacao.observado_em
      ).getTime() >
        new Date(
          atual.observado_em
        ).getTime()
    ) {
      ultimaPorCombinacao.set(
        chave,
        observacao
      );
    }
  }

  return [...todas]
    .sort(
      (a, b) => {
        const obsA =
          ultimaPorCombinacao.get(
            chaveCombinacao(
              a.ida,
              a.volta
            )
          );

        const obsB =
          ultimaPorCombinacao.get(
            chaveCombinacao(
              b.ida,
              b.volta
            )
          );

        if (!obsA && obsB) {
          return -1;
        }

        if (obsA && !obsB) {
          return 1;
        }

        if (!obsA && !obsB) {
          return (
            a.ida.localeCompare(
              b.ida
            ) ||
            a.permanencia -
              b.permanencia
          );
        }

        const tempoA =
          new Date(
            obsA!.observado_em
          ).getTime();

        const tempoB =
          new Date(
            obsB!.observado_em
          ).getTime();

        if (tempoA !== tempoB) {
          return tempoA - tempoB;
        }

        return (
          Number(
            obsA!.preco_por_pessoa
          ) -
          Number(
            obsB!.preco_por_pessoa
          )
        );
      }
    )
    .slice(
      0,
      limite
    );
}

async function lerIgnav(
  apiKey: string,
  combinacao: Combinacao,
  rota: RotaProvider
) {
  const resposta =
    await fetch(
      `${IGNAV_BASE_URL}/fares/round-trip`,
      {
        method:
          "POST",

        cache:
          "no-store",

        headers: {
          "X-Api-Key":
            apiKey,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            origin:
              rota.origemProvider,
            destination:
              rota.destinoProvider,

            departure_date:
              combinacao.ida,

            return_date:
              combinacao.volta,

            adults:
              1,

            cabin_class:
              "economy",

            market:
              "BR",

            max_stops:
              1,

            allow_self_transfer:
              false,
          }),
      }
    );

  const texto =
    await resposta.text();

  let dados: any = {};

  if (texto) {
    try {
      dados =
        JSON.parse(texto);
    } catch {
      dados = {
        texto,
      };
    }
  }

  if (!resposta.ok) {
    throw new Error(
      `Ignav HTTP ${resposta.status}: ${
        dados?.message ||
        dados?.error ||
        dados?.detail ||
        "erro sem detalhe"
      }`
    );
  }

  const itinerarios =
    Array.isArray(
      dados?.itineraries
    )
      ? dados.itineraries
      : [];

  const ofertas =
    itinerarios
      .map(
        (item: any) => ({
          item,

          preco:
            Number(
              item?.price?.amount
            ),

          status:
            item?.price?.status ||
            null,
        })
      )
      .filter(
        (item: {
          preco: number;
        }) =>
          Number.isFinite(
            item.preco
          ) &&
          item.preco > 0
      )
      .sort(
        (
          a: {
            preco: number;
          },
          b: {
            preco: number;
          }
        ) =>
          a.preco -
          b.preco
      );

  const verificadas =
    ofertas.filter(
      (oferta: {
        status: string | null;
      }) =>
        oferta.status ===
        "verified"
    );

  const melhor =
    (
      verificadas.length
        ? verificadas
        : ofertas
    )[0] || null;

  return {
    total:
      ofertas.length,

    melhor,
  };
}

async function executar(
  request: NextRequest
) {
  if (!autorizado(request)) {
    return NextResponse.json(
      {
        sucesso:
          false,

        erro:
          "Nao autorizado.",
      },
      {
        status:
          401,
      }
    );
  }

  const ignavKey =
    process.env
      .IGNAV_API_KEY
      ?.trim();

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ||
    process.env
      .SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    process.env
      .SUPABASE_SERVICE_KEY;

  if (
    !ignavKey ||
    !supabaseUrl ||
    !serviceKey
  ) {
    return NextResponse.json(
      {
        sucesso:
          false,

        erro:
          "Variaveis Ignav/Supabase incompletas.",
      },
      {
        status:
          500,
      }
    );
  }

  const url =
    new URL(
      request.url
    );

  const radarSlug =
    url.searchParams
      .get("slug")
      ?.trim() ||
    RADAR_PADRAO;

  const rota =
    ROTAS[radarSlug];

  if (!rota) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          "Radar informado nao existe.",
      },
      {
        status: 400,
      }
    );
  }

  const solicitado =
    Number(
      url.searchParams.get(
        "limite"
      ) ||
      LIMITE_PADRAO
    );

  const limite =
    Math.min(
      LIMITE_MAXIMO,
      Math.max(
        1,
        Number.isFinite(
          solicitado
        )
          ? Math.trunc(
              solicitado
            )
          : LIMITE_PADRAO
      )
    );

  const supabase =
    createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,
        },
      }
    );

  let execucaoId:
    | string
    | null =
    null;

  try {
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
        `Radar: ${erroRadar.message}`
      );
    }

    const radarDb =
      radar as RadarDb;

    const {
      data: historico,
      error: erroHistorico,
    } =
      await supabase
        .from(
          "viagens_precos"
        )
        .select(`
          ida,
          volta,
          preco_por_pessoa,
          observado_em,
          provider
        `)
        .eq(
          "radar_id",
          radarDb.id
        )
        .neq(
          "provider",
          "simulacao-interna"
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

    if (erroHistorico) {
      throw new Error(
        `Historico: ${erroHistorico.message}`
      );
    }

    const historicoReal =
      (historico || [])
        .map(
          (item: any) => ({
            ida:
              String(
                item.ida
              ),

            volta:
              String(
                item.volta
              ),

            preco_por_pessoa:
              Number(
                item.preco_por_pessoa
              ),

            observado_em:
              String(
                item.observado_em
              ),
          })
        )
        .filter(
          (
            item:
              ObservacaoAnterior
          ) =>
            Number.isFinite(
              item.preco_por_pessoa
            )
        );

    const valoresHistoricos =
      historicoReal.map(
        (item) =>
          item.preco_por_pessoa
      );

    const mediaHistorica =
      media(
        valoresHistoricos
      );

    const todas =
      gerarCombinacoes();

    const selecionadas =
      selecionarCombinacoes(
        todas,
        historicoReal,
        limite
      );

    const {
      data: execucao,
      error: erroExecucao,
    } =
      await supabase
        .from(
          "viagens_execucoes"
        )
        .insert({
          radar_id:
            radarDb.id,

          provider:
            "ignav",

          status:
            "iniciada",

          combinacoes_planejadas:
            selecionadas.length,

          metadata: {
            tipo:
              "radar_automatico",

            slug:
              radarSlug,

            origem_provider:
              rota.origemProvider,

            destino_provider:
              rota.destinoProvider,

            limite:
              selecionadas.length,

            simulado:
              false,
          },

          iniciada_em:
            new Date()
              .toISOString(),
        })
        .select(
          "id"
        )
        .single();

    if (erroExecucao) {
      throw new Error(
        `Execucao: ${erroExecucao.message}`
      );
    }

    execucaoId =
      String(
        execucao.id
      );

    const resultados:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];

    let consultadas =
      0;

    let gravadas =
      0;

    let oportunidades =
      0;

    let erros =
      0;

    for (
      const combinacao of
      selecionadas
    ) {
      consultadas += 1;

      try {
        const resposta =
          await lerIgnav(
            ignavKey,
            combinacao,
            rota
          );

        if (
          !resposta.melhor
        ) {
          resultados.push({
            ...combinacao,

            sucesso:
              true,

            ofertas:
              0,

            preco:
              null,
          });

          continue;
        }

        const oferta =
          resposta.melhor.item;

        const preco =
          resposta.melhor.preco;

        const classificacao =
          classificar(
            radarDb,
            preco
          );

        if (
          [
            "achado_absurdo",
            "preco_bom",
            "interessante",
          ].includes(
            classificacao.faixa
          )
        ) {
          oportunidades +=
            1;
        }

        const abaixoMedia =
          percentualAbaixo(
            preco,
            mediaHistorica
          );

        let score =
          classificacao
            .prioridade *
          20;

        if (
          abaixoMedia !== null &&
          abaixoMedia > 0
        ) {
          score +=
            Math.min(
              20,
              abaixoMedia
            );
        }

        const {
          error:
            erroPreco,
        } =
          await supabase
            .from(
              "viagens_precos"
            )
            .insert({
              radar_id:
                radarDb.id,

              execucao_id:
                execucaoId,

              provider:
                "ignav",

              provider_offer_id:
                oferta?.ignav_id ||
                null,

              tipo_preco:
                oferta?.price
                  ?.status ===
                "verified"
                  ? "live"
                  : "indicative",

              origem_codigo:
                rota.origemProvider,

              destino_codigo:
                rota.destinoProvider,

              ida:
                combinacao.ida,

              volta:
                combinacao.volta,

              permanencia_dias:
                combinacao
                  .permanencia,

              adultos:
                1,

              criancas:
                0,

              bebes:
                0,

              cabine:
                "economica",

              moeda:
                oferta?.price
                  ?.currency ||
                "BRL",

              preco_por_pessoa:
                preco,

              preco_total:
                preco,

              faixa:
                classificacao
                  .faixa,

              score:
                Number(
                  score.toFixed(
                    2
                  )
                ),

              media_historica:
                mediaHistorica ===
                null
                  ? null
                  : Number(
                      mediaHistorica
                        .toFixed(
                          2
                        )
                    ),

              percentual_abaixo_media:
                abaixoMedia ===
                null
                  ? null
                  : Number(
                      abaixoMedia
                        .toFixed(
                          2
                        )
                    ),

              dados_brutos: {
                simulado:
                  false,

                fonte:
                  "ignav",

                automatico:
                  true,

                status_preco:
                  oferta?.price
                    ?.status ||
                  null,

                companhia:
                  oferta
                    ?.outbound
                    ?.carrier ||
                  oferta
                    ?.legs?.[0]
                    ?.carrier ||
                  null,

                bagagem:
                  oferta?.bags ||
                  null,

                self_transfer:
                  Boolean(
                    oferta
                      ?.requires_self_transfer
                  ),

                itinerario:
                  oferta,
              },

              observado_em:
                new Date()
                  .toISOString(),
            });

        if (erroPreco) {
          throw new Error(
            erroPreco.message
          );
        }

        gravadas += 1;

        resultados.push({
          ...combinacao,

          sucesso:
            true,

          ofertas:
            resposta.total,

          preco,

          faixa:
            classificacao.faixa,

          titulo:
            classificacao.titulo,
        });
      } catch (erro) {
        erros += 1;

        resultados.push({
          ...combinacao,

          sucesso:
            false,

          erro:
            erro instanceof Error
              ? erro.message
              : String(
                  erro
                ),
        });
      }
    }

    const statusFinal =
      erros === 0
        ? "sucesso"
        : gravadas > 0
          ? "parcial"
          : "erro";

    const {
      error:
        erroFinalizacao,
    } =
      await supabase
        .from(
          "viagens_execucoes"
        )
        .update({
          status:
            statusFinal,

          combinacoes_consultadas:
            consultadas,

          oportunidades_no_alvo:
            oportunidades,

          erro:
            erros > 0
              ? `${erros} consulta(s) com erro.`
              : null,

          metadata: {
            tipo:
              "radar_automatico",

            slug:
              radarSlug,

            origem_provider:
              rota.origemProvider,

            destino_provider:
              rota.destinoProvider,

            limite,

            consultadas,

            gravadas,

            oportunidades,

            erros,

            simulado:
              false,

            combinacoes:
              selecionadas,
          },

          finalizada_em:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          execucaoId
        );

    if (erroFinalizacao) {
      throw new Error(
        `Finalizacao: ${erroFinalizacao.message}`
      );
    }

    return NextResponse.json(
      {
        sucesso:
          statusFinal !==
          "erro",

        status:
          statusFinal,

        radar:
          radarSlug,

        provider:
          "ignav",

        execucao_id:
          execucaoId,

        consultas:
          consultadas,

        observacoes_gravadas:
          gravadas,

        oportunidades,

        erros,

        resultados,

        executadoEm:
          new Date()
            .toISOString(),
      },
      {
        status:
          statusFinal ===
          "erro"
            ? 500
            : 200,
      }
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(
            erro
          );

    if (
      execucaoId &&
      supabaseUrl &&
      serviceKey
    ) {
      try {
        const supabaseErro =
          createClient(
            supabaseUrl,
            serviceKey,
            {
              auth: {
                persistSession:
                  false,

                autoRefreshToken:
                  false,
              },
            }
          );

        await supabaseErro
          .from(
            "viagens_execucoes"
          )
          .update({
            status:
              "erro",

            erro:
              mensagem,

            finalizada_em:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            execucaoId
          );
      } catch {
        // Mantem o erro original.
      }
    }

    return NextResponse.json(
      {
        sucesso:
          false,

        erro:
          mensagem,
      },
      {
        status:
          500,
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  return executar(
    request
  );
}

export async function POST(
  request: NextRequest
) {
  return executar(
    request
  );
}