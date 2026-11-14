"use client";

import { useEffect, useMemo, useState } from "react";

type StatusDisponibilidade =
  | "nao_verificado"
  | "disponivel"
  | "suspeito"
  | "indisponivel"
  | "erro";

type OfertaStatus = {
  id: string;
  chave: string;
  origem_tabela: "viagens_pacotes" | "viagens_ingressos";
  tipo: "pacote" | "hotel" | "ingresso" | "carro" | "cruzeiro" | "passeio" | "outro";
  titulo: string;
  status: string;
  parceiro: string;
  local_resumo?: string | null;
  origem_codigo?: string | null;
  destino_codigo?: string | null;
  data_ida?: string | null;
  data_volta?: string | null;
  disponibilidade_status: StatusDisponibilidade;
  disponibilidade_falhas: number;
  disponibilidade_verificada_em: string | null;
  disponibilidade_motivo: string | null;
  disponibilidade_ultima_ok_em: string | null;
};

type RespostaStatus = {
  sucesso?: boolean;
  erro?: string;
  ofertas?: OfertaStatus[];
  pacotes?: OfertaStatus[];
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

const tipoVisual: Record<OfertaStatus["tipo"], { label: string; icone: string }> = {
  pacote: { label: "Pacote", icone: "📦" },
  hotel: { label: "Hotel", icone: "🏨" },
  ingresso: { label: "Ingresso", icone: "🎟️" },
  carro: { label: "Carro", icone: "🚗" },
  cruzeiro: { label: "Cruzeiro", icone: "🚢" },
  passeio: { label: "Passeio", icone: "🎡" },
  outro: { label: "Outro", icone: "✨" },
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
    data_final_passou: "O período da oferta já terminou.",
    data_de_uso_passou: "A data de uso já passou.",
    validade_expirada: "A validade cadastrada expirou.",
    hotel_nao_confere: "O hotel retornado pela Decolar não confere.",
    datas_nao_conferem: "As datas retornadas pela Decolar mudaram.",
    preco_nao_encontrado: "O preço deixou de aparecer na consulta.",
    extracao_inconclusiva: "A consulta não trouxe dados suficientes.",
    validacao_inconclusiva: "Não foi possível concluir a validação.",
    parceiro_ou_link_nao_suportado: "Parceiro ou link ainda não suportado pelo monitor.",
    link_ausente: "Oferta sem link original/afiliado para conferir.",
    link_parceiro_acessivel: "Link do parceiro respondeu normalmente.",
    link_http_404: "O link retornou página não encontrada (404).",
    link_http_410: "O link foi removido pelo parceiro (410).",
  };

  if (valor.startsWith("parceiro_bloqueou_verificacao_http_")) {
    return "O parceiro bloqueou a checagem automática; a oferta não foi inativada.";
  }
  if (valor.startsWith("falha_tecnica_link:")) {
    return "Falha técnica ao consultar o link; a oferta não foi inativada.";
  }

  return mapa[valor] || valor;
}

export default function PacotesDisponibilidade() {
  const [ofertas, setOfertas] = useState<OfertaStatus[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [excluindo, setExcluindo] = useState(false);

  async function carregar() {
    try {
      setErro("");
      const resposta = await fetch("/api/admin/viagens/pacotes/status", { cache: "no-store" });
      const dados = (await resposta.json()) as RespostaStatus;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao carregar a saúde das ofertas.");
      }

      setOfertas(dados.ofertas ?? dados.pacotes ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar saúde das ofertas.");
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
        throw new Error(dados.erro || "Falha ao verificar as ofertas.");
      }

      const resumo = dados.resumo ?? {};
      const partes = Object.entries(resumo)
        .filter(([, quantidade]) => quantidade > 0)
        .map(([status, quantidade]) => `${quantidade} ${status}`);

      setAviso(
        `Verificação concluída: ${dados.verificados ?? 0} oferta(s).${partes.length ? ` ${partes.join(" · ")}.` : ""}`
      );
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao verificar ofertas.");
    } finally {
      setVerificando(false);
    }
  }

  async function excluirSelecionados() {
    if (selecionados.length === 0) return;

    const confirmado = window.confirm(
      `Excluir permanentemente ${selecionados.length} oferta(s) selecionada(s)? Esta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    try {
      setExcluindo(true);
      setErro("");
      setAviso("");

      const itens = ofertas
        .filter((oferta) => selecionados.includes(oferta.chave))
        .map((oferta) => ({ tabela: oferta.origem_tabela, id: oferta.id }));

      const resposta = await fetch("/api/admin/viagens/pacotes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao excluir ofertas.");
      }

      const chavesExcluidas = new Set(
        (dados.itens ?? []).map((item: { tabela: string; id: string }) => `${item.tabela}:${item.id}`)
      );
      setOfertas((atuais) => atuais.filter((oferta) => !chavesExcluidas.has(oferta.chave)));
      setSelecionados([]);
      setAviso(`${dados.excluidos ?? 0} oferta(s) excluída(s) com sucesso.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao excluir ofertas.");
    } finally {
      setExcluindo(false);
    }
  }

  function alternarSelecionado(chave: string) {
    setSelecionados((atuais) =>
      atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]
    );
  }

  function alternarTodos() {
    if (selecionados.length === ofertas.length) {
      setSelecionados([]);
    } else {
      setSelecionados(ofertas.map((oferta) => oferta.chave));
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

    for (const oferta of ofertas) {
      const chave = oferta.disponibilidade_status || "nao_verificado";
      if (chave in base) base[chave as keyof typeof base] += 1;
    }

    return base;
  }, [ofertas]);

  return (
    <section className="mt-6 rounded-3xl border border-sky-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-sky-600">
            Monitor de disponibilidade
          </p>
          <h2 className="mt-2 text-2xl font-black">Saúde das ofertas de viagem</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Pacotes usam validação completa de voo + hotel. Hotéis, ingressos, carros, cruzeiros e passeios
            são conferidos por validade, datas e resposta do link do parceiro. Bloqueio técnico do parceiro
            nunca remove a oferta automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {selecionados.length > 0 && (
            <button
              type="button"
              onClick={excluirSelecionados}
              disabled={excluindo}
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {excluindo ? "🗑️ Excluindo..." : `🗑️ Excluir selecionados (${selecionados.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={verificarAgora}
            disabled={verificando}
            className="rounded-xl bg-sky-600 px-5 py-3 font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verificando ? "🔄 Verificando..." : "🔎 Verificar agora"}
          </button>
        </div>
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
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as ofertas"
                  checked={ofertas.length > 0 && selecionados.length === ofertas.length}
                  onChange={alternarTodos}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3 font-black">Oferta</th>
              <th className="px-4 py-3 font-black">Tipo</th>
              <th className="px-4 py-3 font-black">Disponibilidade</th>
              <th className="px-4 py-3 font-black">Última verificação</th>
              <th className="px-4 py-3 font-black">Último OK</th>
              <th className="px-4 py-3 font-black">Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Carregando monitor...
                </td>
              </tr>
            ) : ofertas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma oferta cadastrada.
                </td>
              </tr>
            ) : (
              ofertas.map((oferta) => {
                const status = oferta.disponibilidade_status || "nao_verificado";
                const estilo = visual[status];
                const tipo = tipoVisual[oferta.tipo] || tipoVisual.outro;

                return (
                  <tr key={oferta.chave} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${oferta.titulo}`}
                        checked={selecionados.includes(oferta.chave)}
                        onChange={() => alternarSelecionado(oferta.chave)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{oferta.titulo}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {oferta.local_resumo || "—"} · {oferta.status}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                        {tipo.icone} {tipo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${estilo.classe}`}>
                        {estilo.icone} {estilo.rotulo}
                      </span>
                      {oferta.disponibilidade_falhas > 0 && (
                        <p className="mt-1 text-xs font-bold text-amber-700">
                          {oferta.disponibilidade_falhas} falha(s) consecutiva(s)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dataHora(oferta.disponibilidade_verificada_em)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {dataHora(oferta.disponibilidade_ultima_ok_em)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-600">
                      {motivoLegivel(oferta.disponibilidade_motivo) || "Aguardando primeira verificação."}
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
