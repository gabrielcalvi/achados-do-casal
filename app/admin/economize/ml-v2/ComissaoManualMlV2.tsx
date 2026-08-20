"use client";

import { FormEvent, useEffect, useState } from "react";

type ProdutoMlV2 = {
  item_id: string;
  nome?: string | null;
  url?: string | null;
};

type CandidatoMlV2 = {
  candidato_id?: string | null;
  campanha_id?: string | null;
  titulo?: string | null;
  status?: string | null;
  comissao_estimada_percentual?: number | null;
  comissao_status?: string | null;
  produtos?: ProdutoMlV2[];
};

export default function ComissaoManualMlV2() {
  const [candidatos, setCandidatos] = useState<CandidatoMlV2[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    try {
      const resposta = await fetch(
        "/api/admin/economize/cupons/ml-v2/candidatos/coletados",
        { cache: "no-store", credentials: "include" }
      );
      const dados = (await resposta.json()) as {
        sucesso?: boolean;
        erro?: string;
        candidatos?: CandidatoMlV2[];
      };

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível carregar os candidatos.");
      }

      setCandidatos(
        (dados.candidatos || []).filter((item) => {
          const percentual = item.comissao_estimada_percentual;
          return typeof percentual !== "number" || !Number.isFinite(percentual);
        })
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro carregando candidatos.");
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar(evento: FormEvent, candidato: CandidatoMlV2) {
    evento.preventDefault();

    const id = candidato.candidato_id || "";
    const percentual = valores[id]?.trim();
    const itemId = candidato.produtos?.[0]?.item_id || null;

    if (!id || percentual === undefined || percentual === "") {
      setErro("Informe o percentual da comissão antes de salvar.");
      return;
    }

    try {
      setSalvando(id);
      setErro("");
      setMensagem("");

      const resposta = await fetch(
        `/api/admin/economize/cupons/ml-v2/candidatos/${id}/comissao`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ percentual, item_id: itemId }),
        }
      );
      const dados = (await resposta.json()) as {
        sucesso?: boolean;
        erro?: string;
      };

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Não foi possível salvar a comissão.");
      }

      setMensagem("Comissão manual salva. A tabela principal também passará a exibir esse percentual.");
      setCandidatos((atuais) =>
        atuais.filter((item) => item.candidato_id !== candidato.candidato_id)
      );
      setValores((atuais) => {
        const copia = { ...atuais };
        delete copia[id];
        return copia;
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro salvando comissão.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-slate-500">
            Comissão manual
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Itens que o robô não conseguiu verificar
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Se você abrir o produto e enxergar a comissão na barra de Afiliados do Mercado Livre,
            pode informar o percentual aqui. O valor fica marcado como preenchimento manual.
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          className="rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50"
        >
          Atualizar pendências
        </button>
      </div>

      {mensagem && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      {candidatos.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">
          Nenhuma comissão pendente de preenchimento manual.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {candidatos.map((candidato) => {
            const id = candidato.candidato_id || "";
            const produto = candidato.produtos?.[0];

            return (
              <form
                key={id || candidato.campanha_id || candidato.titulo}
                onSubmit={(evento) => salvar(evento, candidato)}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_160px_auto] lg:items-center"
              >
                <div>
                  <p className="font-black text-slate-950">
                    {candidato.titulo || `Campanha ${candidato.campanha_id || "—"}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Campanha {candidato.campanha_id || "—"}</span>
                    {produto?.item_id && <span>{produto.item_id}</span>}
                    {candidato.comissao_status && (
                      <span>Status: {candidato.comissao_status}</span>
                    )}
                  </div>
                  {produto?.url && (
                    <a
                      href={produto.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-black text-blue-700 hover:underline"
                    >
                      Abrir Produto 1 no Mercado Livre ↗
                    </a>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                    Comissão (%)
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 8"
                    value={valores[id] || ""}
                    onChange={(evento) =>
                      setValores((atuais) => ({
                        ...atuais,
                        [id]: evento.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-bold outline-none focus:border-blue-500"
                  />
                </label>

                <button
                  type="submit"
                  disabled={salvando === id}
                  className="rounded-xl bg-blue-600 px-4 py-3 font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando === id ? "Salvando..." : "Salvar comissão"}
                </button>
              </form>
            );
          })}
        </div>
      )}
    </section>
  );
}
