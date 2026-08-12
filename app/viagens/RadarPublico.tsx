"use client";

import {
  useEffect,
  useState,
} from "react";

type Oferta = {
  ida: string;
  volta: string;
  permanenciaDias: number;
  moeda: string;
  precoPorPessoa: number;
  faixa: string;
  tituloFaixa: string;
  emojiFaixa: string;
  companhia: string | null;
  observadoEm: string;
};

type DadosRadar = {
  sucesso: boolean;

  radar: {
    slug: string;
    nome: string;
    origem: string;
    destino: string;

    regua: {
      achadoAbsurdoAte: number;
      precoBomAte: number;
      interessanteAte: number;
      precoComumAte: number;
    };
  };

  observacoes: number;

  ultimaAtualizacao:
    string | null;

  melhor:
    Oferta | null;

  melhores:
    Oferta[];
};

const RADARES = [
  {
    slug: "poa-orlando",
    label: "Orlando",
    emoji: "✈️",
  },
  {
    slug: "poa-new-york",
    label: "Nova York",
    emoji: "🗽",
  },
  {
    slug: "poa-miami",
    label: "Miami",
    emoji: "🌴",
  },
  {
    slug: "poa-los-angeles",
    label: "Los Angeles",
    emoji: "🎬",
  },
  {
    slug: "poa-lisboa",
    label: "Lisboa",
    emoji: "🇵🇹",
  },
] as const;

function rotuloFaixaRota(
  faixa: string,
  slug: string,
  padrao: string
) {
  if (
    faixa === "achado_absurdo" &&
    (
      slug === "poa-new-york" ||
      slug === "poa-los-angeles"
    )
  ) {
    return "Muito bom";
  }

  if (
    faixa === "achado_absurdo" &&
    slug === "poa-lisboa"
  ) {
    return "Achado";
  }

  if (
    faixa === "preco_comum" &&
    (
      slug === "poa-new-york" ||
      slug === "poa-los-angeles" ||
      slug === "poa-lisboa"
    )
  ) {
    return "Preço normal";
  }

  if (
    faixa === "nao_promocao" &&
    (
      slug === "poa-new-york" ||
      slug === "poa-los-angeles" ||
      slug === "poa-lisboa"
    )
  ) {
    return "Caro";
  }

  return padrao;
}

function dinheiro(
  valor: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }
  ).format(valor);
}

function dataCurta(
  valor: string
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    new Date(
      `${valor}T12:00:00Z`
    )
  );
}

function formatarAtualizacao(
  valor: string | null
) {
  if (!valor) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "America/Sao_Paulo",
    }
  ).format(
    new Date(valor)
  );
}

function estiloFaixa(
  faixa: string
) {
  switch (faixa) {
    case "achado_absurdo":
      return "border-orange-200 bg-orange-50 text-orange-800";

    case "preco_bom":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "interessante":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "nao_promocao":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function leituraRadar(
  faixa: string
) {
  switch (faixa) {
    case "achado_absurdo":
      return "Tarifa dentro da faixa mais rara do nosso Radar.";

    case "preco_bom":
      return "Valor dentro da faixa que consideramos boa para esta rota.";

    case "interessante":
      return "Pode ficar interessante conforme datas e flexibilidade.";

    case "preco_comum":
      return "Ainda acima da faixa que classificamos como promocional.";

    case "nao_promocao":
      return "Valor acima da régua que tratamos como oportunidade.";

    default:
      return "O Radar continua acompanhando esta rota.";
  }
}

export default function RadarPublico() {
  const [
    radarSlug,
    setRadarSlug,
  ] =
    useState(
      "poa-orlando"
    );

  const [
    dados,
    setDados,
  ] =
    useState<DadosRadar | null>(
      null
    );

  const [
    erro,
    setErro,
  ] =
    useState<string | null>(
      null
    );

  useEffect(
    () => {
      let ativo = true;

      setDados(null);
      setErro(null);

      async function carregar() {
        try {
          const resposta =
            await fetch(
              `/api/viagens/radar/destaque?slug=${encodeURIComponent(radarSlug)}`,
              {
                cache: "no-store",
              }
            );

          const json =
            await resposta.json();

          if (
            !resposta.ok ||
            !json.sucesso
          ) {
            throw new Error(
              json.erro ||
              "Radar indisponível."
            );
          }

          if (ativo) {
            setDados(json);
          }
        }
        catch (falha) {
          if (ativo) {
            setErro(
              falha instanceof Error
                ? falha.message
                : "Radar indisponível."
            );
          }
        }
      }

      carregar();

      return () => {
        ativo = false;
      };
    },
    [
      radarSlug,
    ]
  );

  if (erro) {
    return (
      <section
        id="radar-real"
        className="mx-auto max-w-7xl px-5 py-10"
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="font-black text-slate-900">
            ✈️ Radar de passagens
          </p>

          <p className="mt-2 text-sm text-slate-600">
            O Radar está atualizando os dados. Tente novamente em alguns instantes.
          </p>
        </div>
      </section>
    );
  }

  if (!dados) {
    return (
      <section
        id="radar-real"
        className="mx-auto max-w-7xl px-5 py-10"
      >
        <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8">
          <div className="h-6 w-48 rounded bg-slate-200" />
          <div className="mt-5 h-12 w-72 rounded bg-slate-200" />
          <div className="mt-5 h-32 rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

  const melhor =
    dados.melhor;

  const metaAbsurdo =
    dados.radar.regua
      .achadoAbsurdoAte;

  const distanciaAbsurdo =
    melhor
      ? Math.max(
          0,
          melhor.precoPorPessoa -
            metaAbsurdo
        )
      : 0;

  const percentualAcima =
    melhor &&
    metaAbsurdo > 0
      ? (
          distanciaAbsurdo /
          metaAbsurdo
        ) * 100
      : 0;

  const mostrarPrecoBom =
    dados.radar.regua
      .precoBomAte >
    dados.radar.regua
      .achadoAbsurdoAte;

  const mostrarInteressante =
    dados.radar.regua
      .interessanteAte >
    dados.radar.regua
      .precoBomAte;

  const limiteComumAberto =
    dados.radar.regua
      .precoComumAte >=
    900000;

  return (
    <section
      id="radar-real"
      className="mx-auto max-w-7xl px-5 py-10"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {RADARES.map(
          (radar) => (
            <button
              key={radar.slug}
              type="button"
              onClick={() =>
                setRadarSlug(
                  radar.slug
                )
              }
              className={
                "rounded-full border px-4 py-2 text-sm font-black transition " +
                (
                  radarSlug ===
                  radar.slug
                    ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
                )
              }
            >
              {radar.emoji}{" "}
              {radar.label}
            </button>
          )
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-slate-900/5">

        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-800 px-6 py-7 text-white sm:px-8">

          <div className="flex flex-wrap items-center justify-between gap-5">

            <div>
              <div className="flex flex-wrap gap-2">

                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-100">
                  🔴 Radar ativo
                </span>

                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
                  {radarSlug === "poa-orlando"
                    ? "Atualização automática 4x/dia"
                    : "Monitoramento real iniciado"}
                </span>

              </div>

              <h2 className="mt-4 text-3xl font-black sm:text-4xl">
                {dados.radar.nome}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                Preços reais monitorados pelo Achados do Casal para identificar quando esta rota realmente entra em promoção.
              </p>
            </div>

            <div className="flex gap-3">

              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center">
                <p className="text-2xl font-black">
                  {dados.observacoes}
                </p>
                <p className="text-xs font-bold text-blue-100">
                  observações reais
                </p>
              </div>

            </div>

          </div>

        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Melhor preço encontrado
            </p>

            {melhor ? (
              <>
                <div className="mt-2 flex flex-wrap items-end gap-2">

                  <span className="text-5xl font-black tracking-tight text-slate-950">
                    {dinheiro(
                      melhor.precoPorPessoa
                    )}
                  </span>

                  <span className="pb-1 text-sm font-bold text-slate-500">
                    por pessoa
                  </span>

                </div>

                <div className="mt-4 flex flex-wrap gap-2">

                  <span
                    className={
                      "inline-flex rounded-full border px-4 py-2 text-sm font-black " +
                      estiloFaixa(
                        melhor.faixa
                      )
                    }
                  >
                    {melhor.emojiFaixa}{" "}
                    {rotuloFaixaRota(melhor.faixa, radarSlug, melhor.tituloFaixa)}
                  </span>

                  {melhor.companhia && (
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">
                      ✈️ {melhor.companhia}
                    </span>
                  )}

                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Ida
                    </p>
                    <p className="mt-1 font-black text-slate-900">
                      {dataCurta(
                        melhor.ida
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Volta
                    </p>
                    <p className="mt-1 font-black text-slate-900">
                      {dataCurta(
                        melhor.volta
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Permanência
                    </p>
                    <p className="mt-1 font-black text-slate-900">
                      {melhor.permanenciaDias} dias
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Atualizado
                    </p>
                    <p className="mt-1 font-black text-slate-900">
                      {formatarAtualizacao(
                        dados.ultimaAtualizacao
                      )}
                    </p>
                  </div>

                </div>

                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">

                  <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                    Leitura do Radar
                  </p>

                  <p className="mt-2 font-black text-slate-950">
                    {leituraRadar(
                      melhor.faixa
                    )}
                  </p>

                  {distanciaAbsurdo > 0 && (
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Hoje faltam{" "}
                      <strong className="text-slate-900">
                        {dinheiro(
                          distanciaAbsurdo
                        )}
                      </strong>{" "}
                      para entrar na faixa
                      🔥 {rotuloFaixaRota(
                        "achado_absurdo",
                        radarSlug,
                        "Achado Absurdo"
                      )}
                      {" "}
                      (
                      {percentualAcima.toFixed(
                        0
                      )}
                      % acima do gatilho).
                    </p>
                  )}

                </div>

              </>
            ) : (
              <p className="mt-4 text-slate-600">
                O Radar ainda está construindo o histórico desta rota.
              </p>
            )}

          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">

            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Régua de preço {dados.radar.origem} → {dados.radar.destino}
            </p>

            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Quando consideramos promoção?
            </h3>

            <div className="mt-5 space-y-3">

              <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div>
                  <p className="font-black text-orange-900">
                    🔥 {rotuloFaixaRota(
                      "achado_absurdo",
                      radarSlug,
                      "Achado absurdo"
                    )}
                  </p>
                  <p className="text-xs text-orange-700">
                    Valor que merece atenção imediata
                  </p>
                </div>
                <strong className="text-orange-900">
                  até{" "}
                  {dinheiro(
                    dados.radar.regua
                      .achadoAbsurdoAte
                  )}
                </strong>
              </div>

              <div
                style={{
                  display:
                    mostrarPrecoBom
                      ? undefined
                      : "none",
                }}
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
              >
                <div>
                  <p className="font-black text-emerald-900">
                    🟢 Preço bom
                  </p>
                </div>
                <strong className="text-emerald-900">
                  até{" "}
                  {dinheiro(
                    dados.radar.regua
                      .precoBomAte
                  )}
                </strong>
              </div>

              <div
                style={{
                  display:
                    mostrarInteressante
                      ? undefined
                      : "none",
                }}
                className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div>
                  <p className="font-black text-amber-900">
                    🟡 Interessante
                  </p>
                </div>
                <strong className="text-amber-900">
                  até{" "}
                  {dinheiro(
                    dados.radar.regua
                      .interessanteAte
                  )}
                </strong>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="font-black text-slate-800">
                    ⚪ {rotuloFaixaRota(
                      "preco_comum",
                      radarSlug,
                      "Preço comum"
                    )}
                  </p>
                </div>
                <strong className="text-slate-800">
{limiteComumAberto ? (
                    <>
                      acima de{" "}
                      {dinheiro(
                        dados.radar.regua
                          .interessanteAte
                      )}
                    </>
                  ) : (
                    <>
                      até{" "}
                      {dinheiro(
                        dados.radar.regua
                          .precoComumAte
                      )}
                    </>
                  )}
                </strong>
              </div>

              <div
                style={{
                  display:
                    limiteComumAberto
                      ? "none"
                      : undefined,
                }}
                className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4"
              >
                <p className="font-black text-red-800">
                  ❌ {rotuloFaixaRota(
                    "nao_promocao",
                    radarSlug,
                    "Não é promoção"
                  )}
                </p>
                <strong className="text-red-800">
                  acima de{" "}
                  {dinheiro(
                    dados.radar.regua
                      .precoComumAte
                  )}
                </strong>
              </div>

            </div>

          </div>

        </div>

        <div className="border-t border-slate-100 px-6 py-7 sm:px-8">

          <div className="flex flex-wrap items-end justify-between gap-3">

            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-700">
                Flexibilidade faz diferença
              </p>

              <h3 className="mt-1 text-2xl font-black text-slate-950">
                5 melhores datas encontradas
              </h3>
            </div>

            <p className="text-xs font-semibold text-slate-500">
              Quanto mais flexível, maior a chance de economizar.
            </p>

          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">

            {dados.melhores.map(
              (
                oferta,
                indice
              ) => (
                <div
                  key={
                    `${oferta.ida}-${oferta.volta}`
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-md"
                >

                  <div className="flex items-center justify-between gap-3">

                    <span
                      className="flex shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white"
                      style={{
                        width: 30,
                        height: 30,
                        minWidth: 30,
                      }}
                    >
                      {indice + 1}
                    </span>

                    <span
                      className={
                        "rounded-full border px-3 py-1 text-xs font-black " +
                        estiloFaixa(
                          oferta.faixa
                        )
                      }
                    >
                      {oferta.emojiFaixa}{" "}
                      {rotuloFaixaRota(oferta.faixa, radarSlug, oferta.tituloFaixa)}
                    </span>

                  </div>

                  <p className="mt-4 font-black text-slate-950">
                    {dataCurta(
                      oferta.ida
                    )}
                    {" → "}
                    {dataCurta(
                      oferta.volta
                    )}
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {oferta.permanenciaDias} dias
                    {oferta.companhia
                      ? ` • ${oferta.companhia}`
                      : ""}
                  </p>

                  <p className="mt-4 text-2xl font-black text-slate-950">
                    {dinheiro(
                      oferta.precoPorPessoa
                    )}
                  </p>

                  <p className="text-xs font-semibold text-slate-500">
                    por pessoa
                  </p>

                </div>
              )
            )}

          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-500">

            <p>
              Os valores são observações reais e podem mudar conforme disponibilidade e tarifa.
            </p>

            <p className="font-bold text-slate-700">
              🤖 Visitar esta página não gera uma nova consulta externa.
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}