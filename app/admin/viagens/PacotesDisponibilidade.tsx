"use client";

import { useEffect, useMemo, useState } from "react";

type StatusDisponibilidade =
  | "nao_verificado"
  | "disponivel"
  | "suspeito"
  | "indisponivel"
  | "erro";

type PacoteStatus = {
  id: string;
  titulo: string;
  status: string;
  parceiro: string;
  origem_codigo: string;
  destino_codigo: string;
  data_ida: string;
  data_volta: string;
  disponibilidade_status: StatusDisponibilidade;
  disponibilidade_falhas: number;
  disponibilidade_verificada_em: string | null;
  disponibilidade_motivo: string | null;
  disponibilidade_ultima_ok_em: string | null;
};

type RespostaStatus = {
  sucesso?: boolean;
  erro?: string;
  pacotes?: PacoteStatus[];
};

type RespostaVerificacao = {
  sucesso?: boolean;
  erro?: string;
  verificados?: number;
  resumo?: Record<string, number>;
};

const visual: Record<StatusDisponibilidade, { rotulo: string; icone: string; classe: string }> = {
  disponivel: {
    rotulo: "Disponível",
    icone: "🟢",
    classe: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  suspeito: {
    rotulo: "Suspeito",
    icone: "🟡",
    classe: "border-amber-200 bg-amber-50 text-amber-800",
  },
  indisponivel: {
    rotulo: "Indisponível",
    icone: "🔴",
    classe: "border-red-200 bg-red-50 text-red-800",
  },
  nao_verificado: {
    rotulo: "Não verificado",
    icone: "⚪",
    classe: "border-slate-200 bg-slate-50 text-slate-700",
  },
  erro: {
    rotulo: "Erro técnico",
    icone: "⚫",
    classe: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

function dataHora(valor: string | null) {
  if (!valor) return "Nunca";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function motivoLegivel(valor: string | null) {
  if (!valor) return null;

  const mapa: Record<string, string> = {
    hotel_datas_preco_confirmados: "Hotel, datas e preço confirmados.",
    data_de_ida_passou: "A data de ida já passou.",
    validade_expirada: "A validade cadastrada expirou.",
    hotel_nao_confere: "O hotel retornado pela Decolar não confere.",
    datas_nao_conferem: "As datas retornadas pela Decolar mudaram.",
    preco_nao_encontrado: "O preço deixou de aparecer na consulta.",
    extracao_inconclusiva: "A consulta não trouxe dados suficientes.",
    validacao_inconclusiva: "Não foi possível concluir a validação.",
    parceiro_ou_link_nao_suportado: "Parceiro ou link ainda não suportado pelo monitor.",
  };

  return mapa[valor] || valor;
}

export default function PacotesDisponibilidade() {
  const [pacotes, setPacotes] = useState<PacoteStatus[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    try {
      setErro("");
      const resposta = await fetch("/api/admin/viagens/pacotes/status", {
        cache: "no-store",
      });
      const dados = (await resposta.json()) as RespostaStatus;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao carregar a disponibilidade dos pacotes.");
      }

      setPacotes(dados.pacotes ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar disponibilidade.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function verificarAgora() {
    try {
      setVerificando(true);
      setErro("");
      setAviso("");

      const resposta = await fetch("/api/admin/viagens/pacotes/verificar", {
        method: "GET",
        cache: "no-store",
      });
      const dados = (await resposta.json()) as RespostaVerificacao;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao verificar os pacotes.");
      }

      const resumo = dados.resumo ?? {};
      const partes = Object.entries(resumo)
        .filter(([, quantidade]) => quantidade > 0)
        .map(([status, quantidade]) => `${quantidade} ${status}`);

      setAviso(
        `Verificação concluída: ${dados.verificados ?? 0} pacote(s).${
          partes.length ? ` ${partes.join(" · ")}.` : ""
        }`
      );
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao verificar pacotes.");
    } finally {
      setVerificando(false);
    }
  }

  const contagem = useMemo(() => {
    const base = {
      disponivel: 0,
      suspeito: 0,
      indisponivel: 0,
      nao_verificado: 0,
      erro: 0,
    };

    for (const pacote of pacotes) {
      const chave = pacote.disponibilidade_status || "nao_verificado";
      if (chave in base) base[chave as keyof typeof base] += 1;
    }

    return base;
  }, [pacotes]);

  return (
    <section className="mt-6 rounded-3xl border border-sky-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-sky-600">
            Monitor de disponibilidade
          </p>
          <h2 className="mt-2 text-2xl font-black">Saúde dos pacotes publicados</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            A verificação automática roda duas vezes por dia. Uma suspeita isolada não remove o pacote; ele só é inativado após confirmação consecutiva do problema.
          </p>
        </div>

        <button
          type="button"
          onClick={verificarAgora}
          disabled={verificando}
          className="rounded-xl bg-sky-600 px-5 py-3 font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verificando ? "🔄 Verificando..." : "🔎 Verificar agora"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(visual) as StatusDisponibilidade[]).map((status) => (
          <div key={status} className={`rounded-2xl border p-4 ${visual[status].classe}`}>
            <p className="text-xs font-black uppercase tracking-wide">
              {visual[status].icone} {visual[status].rotulo}
            </p>
            <p className="mt-2 text-3xl font-black">{contagem[status]}</p>
          </div>
        ))}
      </div>

      {aviso && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {aviso}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-black">Pacote</th>
              <th className="px-4 py-3 font-black">Disponibilidade</th>
              <th className="px-4 py-3 font-black">Última verificação</th>
              <th className="px-4 py-3 font-black">Último OK</th>
              <th className="px-4 py-3 font-black">Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando monitor...
                </td>
              </tr>
            ) : pacotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum pacote cadastrado.
                </td>
              </tr>
            ) : (
              pacotes.map((pacote) => {
                const status = pacote.disponibilidade_status || "nao_verificado";
                const estilo = visual[status];

                return (
                  <tr key={pacote.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{pacote.titulo}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {pacote.origem_codigo} → {pacote.destino_codigo} · {pacote.status}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${estilo.classe}`}>
                        {estilo.icone} {estilo.rotulo}
                      </span>
                      {pacote.disponibilidade_falhas > 0 && (
                        <p className="mt-1 text-xs font-bold text-amber-700">
                          {pacote.disponibilidade_falhas} falha(s) consecutiva(s)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dataHora(pacote.disponibilidade_verificada_em)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dataHora(pacote.disponibilidade_ultima_ok_em)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-600">
                      {motivoLegivel(pacote.disponibilidade_motivo) || "Aguardando primeira verificação."}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
