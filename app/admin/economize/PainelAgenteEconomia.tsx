"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type StatusExecucao =
  | "executando"
  | "concluida"
  | "parcial"
  | "erro";

type LojaExecucao = {
  id: string;
  nome: string;
  slug: string;
};

type ExecucaoAgente = {
  id: string;
  loja_id: string | null;
  status: StatusExecucao;
  ofertas_encontradas: number;
  ofertas_novas: number;
  ofertas_atualizadas: number;
  ofertas_desativadas: number;
  total_erros: number;
  iniciado_em: string;
  finalizado_em: string | null;
  mensagem_erro: string | null;
  detalhes: Record<string, unknown>;
  created_at: string;
  loja: LojaExecucao | null;
};

type RespostaHistorico = {
  execucoes?: ExecucaoAgente[];
  total?: number;
  limite?: number;
  error?: string;
};

type RespostaExecucao = {
  mensagem?: string;
  execucao?: ExecucaoAgente;
  error?: string;
  detalhes?: string;
};

const estilosStatus: Record<
  StatusExecucao,
  {
    rotulo: string;
    classe: string;
  }
> = {
  executando: {
    rotulo: "Executando",
    classe:
      "bg-blue-100 text-blue-700",
  },
  concluida: {
    rotulo: "Concluída",
    classe:
      "bg-emerald-100 text-emerald-700",
  },
  parcial: {
    rotulo: "Parcial",
    classe:
      "bg-amber-100 text-amber-700",
  },
  erro: {
    rotulo: "Erro",
    classe:
      "bg-red-100 text-red-700",
  },
};

function formatarDataHora(valor: string | null) {
  if (!valor) {
    return "—";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "—";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function calcularDuracao(
  inicio: string,
  fim: string | null
) {
  if (!fim) {
    return "Em andamento";
  }

  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime();

  if (
    Number.isNaN(inicioMs) ||
    Number.isNaN(fimMs)
  ) {
    return "—";
  }

  const diferenca = Math.max(
    0,
    fimMs - inicioMs
  );

  if (diferenca < 1000) {
    return `${diferenca} ms`;
  }

  const segundos = diferenca / 1000;

  if (segundos < 60) {
    return `${segundos.toFixed(1)} s`;
  }

  const minutos = Math.floor(
    segundos / 60
  );

  const segundosRestantes = Math.round(
    segundos % 60
  );

  return `${minutos} min ${segundosRestantes} s`;
}

function obterNumeroDetalhe(
  detalhes: Record<string, unknown>,
  chave: string
) {
  const valor = detalhes[chave];

  return typeof valor === "number"
    ? valor
    : null;
}

function obterTextoDetalhe(
  detalhes: Record<string, unknown>,
  chave: string
) {
  const valor = detalhes[chave];

  return typeof valor === "string"
    ? valor
    : null;
}

export default function PainelAgenteEconomia() {
  const [execucoes, setExecucoes] = useState<
    ExecucaoAgente[]
  >([]);

  const [carregando, setCarregando] =
    useState(true);

  const [executando, setExecutando] =
    useState(false);

  const [erro, setErro] = useState("");

  const [mensagem, setMensagem] =
    useState("");

  const carregarHistorico =
    useCallback(async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          "/api/admin/economize/agente/historico?limite=10",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          (await resposta.json()) as RespostaHistorico;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ||
              "Não foi possível carregar o histórico."
          );
        }

        setExecucoes(
          resultado.execucoes ?? []
        );
      } catch (error) {
        console.error(
          "Erro ao carregar histórico do agente:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar o histórico."
        );
      } finally {
        setCarregando(false);
      }
    }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const ultimaExecucao =
    execucoes[0] ?? null;

  const totaisHistorico = useMemo(() => {
    return execucoes.reduce(
      (totais, execucao) => {
        totais.encontradas +=
          execucao.ofertas_encontradas;

        totais.novas +=
          execucao.ofertas_novas;

        totais.atualizadas +=
          execucao.ofertas_atualizadas;

        totais.erros +=
          execucao.total_erros;

        return totais;
      },
      {
        encontradas: 0,
        novas: 0,
        atualizadas: 0,
        erros: 0,
      }
    );
  }, [execucoes]);

  async function executarAgente() {
    try {
      setExecutando(true);
      setErro("");
      setMensagem("");

      const resposta = await fetch(
        "/api/admin/economize/agente/executar",
        {
          method: "POST",
        }
      );

      const resultado =
        (await resposta.json()) as RespostaExecucao;

      if (!resposta.ok) {
        throw new Error(
          resultado.detalhes ||
            resultado.error ||
            "Não foi possível executar o agente."
        );
      }

      setMensagem(
        resultado.mensagem ||
          "Agente executado com sucesso."
      );

      await carregarHistorico();
    } catch (error) {
      console.error(
        "Erro ao executar Agente de Economia:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao executar o agente."
      );
    } finally {
      setExecutando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
            Agente de Economia
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Coleta e monitoramento
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Execute o motor do agente, consulte as
            lojas conectadas e acompanhe o histórico
            das verificações.
          </p>
        </div>

        <button
          type="button"
          onClick={executarAgente}
          disabled={executando}
          className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {executando
            ? "Executando agente..."
            : "🤖 Executar agente"}
        </button>
      </div>

      {mensagem && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">
            {erro}
          </p>

          <button
            type="button"
            onClick={carregarHistorico}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Encontradas
          </p>

          <p className="mt-2 text-3xl font-black">
            {totaisHistorico.encontradas}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Novas
          </p>

          <p className="mt-2 text-3xl font-black text-emerald-700">
            {totaisHistorico.novas}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Atualizadas
          </p>

          <p className="mt-2 text-3xl font-black text-blue-700">
            {totaisHistorico.atualizadas}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Erros
          </p>

          <p className="mt-2 text-3xl font-black text-red-700">
            {totaisHistorico.erros}
          </p>
        </div>
      </div>

      {ultimaExecucao && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">
                Última execução
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Iniciada em{" "}
                {formatarDataHora(
                  ultimaExecucao.iniciado_em
                )}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                estilosStatus[
                  ultimaExecucao.status
                ].classe
              }`}
            >
              {
                estilosStatus[
                  ultimaExecucao.status
                ].rotulo
              }
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold text-slate-500">
                Duração
              </p>

              <p className="mt-1 font-black">
                {calcularDuracao(
                  ultimaExecucao.iniciado_em,
                  ultimaExecucao.finalizado_em
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500">
                Lojas consultadas
              </p>

              <p className="mt-1 font-black">
                {obterNumeroDetalhe(
                  ultimaExecucao.detalhes,
                  "lojas_ativas"
                ) ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500">
                Tipo
              </p>

              <p className="mt-1 font-black">
                {obterTextoDetalhe(
                  ultimaExecucao.detalhes,
                  "tipo"
                ) ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500">
                Origem
              </p>

              <p className="mt-1 font-black">
                {obterTextoDetalhe(
                  ultimaExecucao.detalhes,
                  "origem"
                ) ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black">
            Últimas execuções
          </h3>

          <button
            type="button"
            onClick={carregarHistorico}
            disabled={carregando}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>

        {carregando ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Carregando histórico...
          </div>
        ) : execucoes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-black">
              Nenhuma execução registrada
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Clique em Executar agente para criar
              o primeiro histórico.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {execucoes.map((execucao) => {
              const status =
                estilosStatus[execucao.status];

              return (
                <article
                  key={execucao.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${status.classe}`}
                        >
                          {status.rotulo}
                        </span>

                        <span className="text-sm font-bold text-slate-500">
                          {execucao.loja?.nome ||
                            "Todas as lojas"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        {formatarDataHora(
                          execucao.iniciado_em
                        )}
                        {" • "}
                        {calcularDuracao(
                          execucao.iniciado_em,
                          execucao.finalizado_em
                        )}
                      </p>

                      {execucao.mensagem_erro && (
                        <p className="mt-2 text-sm font-bold text-red-700">
                          {execucao.mensagem_erro}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      <div>
                        <p className="text-xs text-slate-500">
                          Encontradas
                        </p>

                        <p className="font-black">
                          {
                            execucao.ofertas_encontradas
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Novas
                        </p>

                        <p className="font-black text-emerald-700">
                          {execucao.ofertas_novas}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Atualizadas
                        </p>

                        <p className="font-black text-blue-700">
                          {
                            execucao.ofertas_atualizadas
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Desativadas
                        </p>

                        <p className="font-black text-amber-700">
                          {
                            execucao.ofertas_desativadas
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Erros
                        </p>

                        <p className="font-black text-red-700">
                          {execucao.total_erros}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}