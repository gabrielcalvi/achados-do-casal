"use client";

import { useEffect, useState } from "react";

type ProdutoMlV2 = {
  item_id: string;
  nome?: string | null;
  imagem?: string | null;
  url?: string | null;
};

type CandidatoMlV2 = {
  candidato_id?: string | null;
  status?: string | null;
  campanha_id?: string | null;
  titulo?: string | null;
  valor_desconto?: number | null;
  compra_minima?: number | null;
  validade?: string | null;
  escopo?: string | null;
  acao?: string | null;
  tipo_acao?: string | null;
  possui_token_ativacao?: boolean;
  quantidade_produtos?: number;
  produtos?: ProdutoMlV2[];
};

type ResultadoMlV2 = {
  sucesso?: boolean;
  erro?: string;
  total_paginas_lidas?: number;
  total_encontrados?: number;
  valores_encontrados?: number[];
};

function moeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function rotuloEscopo(escopo: string | null | undefined) {
  if (escopo === "produtos_selecionados") return "Produtos selecionados";
  if (escopo === "site_inteiro") return "Site inteiro";
  return "Não identificado";
}

function rotuloStatus(status: string | null | undefined) {
  if (status === "aprovado") return "✅ Aprovado";
  if (status === "descartado") return "❌ Rejeitado";
  if (status === "publicado") return "🟢 Publicado";
  return "🟡 Pendente";
}

export default function PainelMlV2() {
  const [executando, setExecutando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [resultado, setResultado] = useState<ResultadoMlV2 | null>(null);
  const [candidatos, setCandidatos] = useState<CandidatoMlV2[]>([]);
  const [erro, setErro] = useState("");

  async function carregarCandidatos() {
    try {
      setCarregando(true);
      setErro("");

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
        throw new Error(dados.erro || "Não foi possível carregar os candidatos ML V2.");
      }

      setCandidatos(dados.candidatos || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarCandidatos();
  }, []);

  async function executar() {
    try {
      setExecutando(true);
      setErro("");
      setResultado(null);

      const resposta = await fetch(
        "/api/admin/economize/cupons/ml-v2/executar",
        { method: "GET", cache: "no-store", credentials: "include" }
      );
      const dados = (await resposta.json()) as ResultadoMlV2;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "A coleta ML V2 não foi concluída.");
      }

      setResultado(dados);
      await carregarCandidatos();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado no ML V2.");
    } finally {
      setExecutando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-blue-600">
            Mercado Livre V2
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Candidatos oficiais de cupom
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Os candidatos abaixo vêm do banco, já com o ID persistido. Os atalhos de
            produto abrem diretamente os itens participantes. Depois de aprovar, use
            o botão Vincular afiliado para ir direto à etapa final daquele cupom.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={carregarCandidatos}
            disabled={carregando || executando}
            className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Atualizar lista
          </button>
          <button
            type="button"
            onClick={executar}
            disabled={executando}
            className="cursor-pointer rounded-xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executando ? "Executando ML V2..." : "Executar coleta ML V2"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Publicação automática</p>
          <p className="mt-2 font-black text-slate-950">🔒 Bloqueada</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Link de afiliado</p>
          <p className="mt-2 font-black text-slate-950">✅ Obrigatório antes de publicar</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-600">Candidatos carregados</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{candidatos.length}</p>
        </div>
      </div>

      {resultado && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Coleta concluída: {resultado.total_encontrados ?? 0} candidatos em {resultado.total_paginas_lidas ?? 0} páginas.
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </div>
      )}

      {carregando ? (
        <p className="mt-5 font-bold text-slate-500">Carregando candidatos...</p>
      ) : candidatos.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600">
          Nenhum candidato ML V2 encontrado no banco.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-black">Candidato</th>
                <th className="px-4 py-3 font-black">Desconto</th>
                <th className="px-4 py-3 font-black">Compra mínima</th>
                <th className="px-4 py-3 font-black">Escopo</th>
                <th className="px-4 py-3 font-black">Produtos</th>
                <th className="px-4 py-3 font-black">Status</th>
                <th className="px-4 py-3 font-black">Validação</th>
                <th className="px-4 py-3 font-black">Validade</th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((cupom) => {
                const candidatoId = cupom.candidato_id || "";
                const podeAlterar = Boolean(candidatoId) && cupom.status !== "publicado";
                const podeAprovar = podeAlterar && cupom.status !== "aprovado";
                const produtos = cupom.produtos || [];
                const action = `/api/admin/economize/cupons/ml-v2/candidatos/${candidatoId}`;

                return (
                  <tr key={candidatoId || cupom.campanha_id || cupom.titulo || "cupom"} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {cupom.titulo || cupom.campanha_id || "Cupom oficial"}
                      <p className="mt-1 text-xs font-normal text-slate-400">Campanha {cupom.campanha_id || "—"}</p>
                    </td>
                    <td className="px-4 py-3">{moeda(cupom.valor_desconto)}</td>
                    <td className="px-4 py-3">{moeda(cupom.compra_minima)}</td>
                    <td className="px-4 py-3">{rotuloEscopo(cupom.escopo)}</td>
                    <td className="px-4 py-3">
                      {produtos.length > 0 ? (
                        <div className="flex min-w-52 flex-wrap gap-2">
                          {produtos.slice(0, 4).map((produto, indice) =>
                            produto.url ? (
                              <a
                                key={`${produto.item_id}-${indice}`}
                                href={produto.url}
                                target="_blank"
                                rel="noreferrer"
                                title={produto.nome || produto.item_id}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                              >
                                Produto {indice + 1}
                              </a>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Sem item específico</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold">{rotuloStatus(cupom.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-48 flex-wrap gap-2">
                        <form method="post" action={action}>
                          <input type="hidden" name="acao" value="aprovar" />
                          <button
                            type="submit"
                            disabled={!podeAprovar}
                            className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {cupom.status === "aprovado" ? "Aprovado" : "Aprovar"}
                          </button>
                        </form>
                        <form method="post" action={action}>
                          <input type="hidden" name="acao" value="rejeitar" />
                          <button
                            type="submit"
                            disabled={!podeAlterar}
                            className="cursor-pointer rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Rejeitar
                          </button>
                        </form>
                        {cupom.status === "aprovado" && candidatoId && (
                          <a
                            href={`#afiliado-${candidatoId}`}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100 active:scale-95"
                          >
                            🔗 Vincular afiliado
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cupom.validade ? new Date(cupom.validade).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
