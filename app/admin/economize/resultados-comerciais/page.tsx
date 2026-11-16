"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Venda = {
  id: number;
  data_venda: string;
  status: "confirmada" | "pendente" | "cancelada";
  origem: string;
  loja: string | null;
  produto: string | null;
  programa_afiliado: string | null;
  valor_venda: number | null;
  comissao: number | null;
  moeda: string;
  fonte: string;
  observacoes: string | null;
};

type RespostaResultados = {
  periodo: { dias: number; inicio: string; fim: string };
  resumo: {
    vendasConfirmadas: number;
    vendasPendentes: number;
    vendasCanceladas: number;
    valorVendido: number;
    comissaoGerada: number;
    cliquesHumanos: number;
    sessoesHumanas: number;
    taxaCliqueVenda: number;
    variacaoVendas: number;
    vendasPeriodoAnterior: number;
    cliquesPeriodoAnterior: number;
  };
  porLoja: Array<{ nome: string; vendas: number; valor: number; comissao: number }>;
  porCanal: Array<{ nome: string; vendas: number; valor: number; comissao: number }>;
  vendas: Venda[];
  atualizadoEm: string;
  error?: string;
};

const hoje = new Date().toISOString().slice(0, 10);

function moeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function dataBr(valor: string) {
  if (!valor) return "—";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function variacao(valor: number) {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(1).replace(".0", "")}%`;
}

export default function ResultadosComerciaisPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RespostaResultados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  const [form, setForm] = useState({
    dataVenda: hoje,
    status: "confirmada",
    origem: "site",
    loja: "",
    produto: "",
    programaAfiliado: "",
    valorVenda: "",
    comissao: "",
    observacoes: "",
  });

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(
        `/api/admin/economize/resultados-comerciais?dias=${dias}`,
        { cache: "no-store" },
      );
      const resultado = (await resposta.json()) as RespostaResultados;
      if (!resposta.ok) throw new Error(resultado.error || "Não foi possível carregar.");
      setDados(resultado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [dias]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta = await fetch("/api/admin/economize/resultados-comerciais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.error || "Não foi possível salvar.");

      setSucesso("Venda registrada no painel.");
      setForm({
        dataVenda: hoje,
        status: "confirmada",
        origem: "site",
        loja: "",
        produto: "",
        programaAfiliado: "",
        valorVenda: "",
        comissao: "",
        observacoes: "",
      });
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setSalvando(false);
    }
  }

  const maiorCanal = useMemo(
    () => Math.max(1, ...(dados?.porCanal.map((item) => item.vendas) ?? [1])),
    [dados],
  );

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                Monetização real
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                💰 Resultados comerciais
              </h1>
              <p className="mt-4 max-w-3xl leading-7 text-slate-300">
                Vendas confirmadas, valor vendido, comissão e origem do tráfego.
                Quando os parceiros disponibilizarem relatórios de conversão, este painel
                já está preparado para receber importações além do cadastro manual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setDias(valor)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                    dias === valor
                      ? "bg-white text-slate-950"
                      : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {valor} dias
                </button>
              ))}
            </div>
          </div>
        </header>

        {erro ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {erro}
          </div>
        ) : null}
        {sucesso ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
            {sucesso}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              titulo: "Vendas confirmadas",
              valor: dados?.resumo.vendasConfirmadas ?? 0,
              detalhe: dados ? variacao(dados.resumo.variacaoVendas) : "—",
            },
            {
              titulo: "Valor vendido",
              valor: moeda(dados?.resumo.valorVendido),
              detalhe: "GMV rastreado",
            },
            {
              titulo: "Comissão gerada",
              valor: moeda(dados?.resumo.comissaoGerada),
              detalhe: "confirmada",
            },
            {
              titulo: "Clique → venda",
              valor: `${dados?.resumo.taxaCliqueVenda ?? 0}%`,
              detalhe: "conversão registrada",
            },
            {
              titulo: "Cliques humanos",
              valor: dados?.resumo.cliquesHumanos ?? 0,
              detalhe: `${dados?.resumo.sessoesHumanas ?? 0} sessões`,
            },
          ].map((card) => (
            <div
              key={card.titulo}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-bold text-slate-500">{card.titulo}</p>
              <p className="mt-2 text-3xl font-black">
                {carregando ? "…" : card.valor}
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">
                {card.detalhe}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-600">
              Histórico
            </p>
            <h2 className="mt-1 text-2xl font-black">Vendas registradas</h2>

            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.vendas ?? []).map((venda) => (
                <div key={venda.id} className="grid gap-3 py-4 md:grid-cols-[110px_1fr_auto] md:items-center">
                  <div>
                    <p className="font-black">{dataBr(venda.data_venda)}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        venda.status === "confirmada"
                          ? "bg-emerald-100 text-emerald-800"
                          : venda.status === "pendente"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {venda.status}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black">
                      {venda.produto || "Produto ainda não informado"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {venda.loja || "Loja não informada"} · {venda.origem}
                      {venda.programa_afiliado ? ` · ${venda.programa_afiliado}` : ""}
                    </p>
                    {venda.observacoes ? (
                      <p className="mt-1 text-xs text-slate-400">{venda.observacoes}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black">{moeda(venda.valor_venda)}</p>
                    <p className="text-xs font-bold text-emerald-700">
                      comissão {moeda(venda.comissao)}
                    </p>
                  </div>
                </div>
              ))}
              {!carregando && (dados?.vendas.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-slate-500">Nenhuma venda registrada neste período.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-blue-600">
              Registro rápido
            </p>
            <h2 className="mt-1 text-2xl font-black">Adicionar venda</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use enquanto Amazon, AWIN, Mercado Livre e outros parceiros não estiverem
              importando automaticamente seus relatórios.
            </p>

            <form onSubmit={enviar} className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold">
                  Data
                  <input
                    type="date"
                    value={form.dataVenda}
                    onChange={(e) => setForm({ ...form, dataVenda: e.target.value })}
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                    required
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                  >
                    <option value="confirmada">Confirmada</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold">
                  Origem
                  <select
                    value={form.origem}
                    onChange={(e) => setForm({ ...form, origem: e.target.value })}
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                  >
                    <option value="site">Site</option>
                    <option value="instagram">Instagram</option>
                    <option value="central_economize">Central Economize</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="youtube">YouTube</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-bold">
                  Loja
                  <input
                    value={form.loja}
                    onChange={(e) => setForm({ ...form, loja: e.target.value })}
                    placeholder="Amazon, Mercado Livre..."
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-bold">
                Produto
                <input
                  value={form.produto}
                  onChange={(e) => setForm({ ...form, produto: e.target.value })}
                  placeholder="Nome do item vendido"
                  className="rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-bold">
                Programa afiliado
                <input
                  value={form.programaAfiliado}
                  onChange={(e) => setForm({ ...form, programaAfiliado: e.target.value })}
                  placeholder="Amazon Associados, AWIN..."
                  className="rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-bold">
                  Valor vendido
                  <input
                    inputMode="decimal"
                    value={form.valorVenda}
                    onChange={(e) => setForm({ ...form, valorVenda: e.target.value.replace(",", ".") })}
                    placeholder="0.00"
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold">
                  Comissão
                  <input
                    inputMode="decimal"
                    value={form.comissao}
                    onChange={(e) => setForm({ ...form, comissao: e.target.value.replace(",", ".") })}
                    placeholder="0.00"
                    className="rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-bold">
                Observações
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={3}
                  className="rounded-xl border border-slate-300 px-3 py-2.5"
                  placeholder="ID do pedido, campanha, detalhes..."
                />
              </label>

              <button
                type="submit"
                disabled={salvando}
                className="mt-2 rounded-xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Registrar venda"}
              </button>
            </form>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-violet-600">
              Conversão por canal
            </p>
            <h2 className="mt-1 text-2xl font-black">De onde estão vindo as vendas</h2>
            <div className="mt-5 space-y-4">
              {(dados?.porCanal ?? []).map((canal) => (
                <div key={canal.nome}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-black">{canal.nome}</span>
                    <span className="text-right font-bold text-slate-500">
                      <span className="block">
                        {canal.vendas} venda(s) · {moeda(canal.valor)}
                      </span>
                      <span className="mt-0.5 block text-xs font-black text-emerald-700">
                        {moeda(canal.comissao)} comissão
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-600"
                      style={{ width: `${Math.max(8, (canal.vendas / maiorCanal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!carregando && (dados?.porCanal.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Ainda não há dados suficientes.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-orange-600">
              Resultado por parceiro
            </p>
            <h2 className="mt-1 text-2xl font-black">Lojas que estão convertendo</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.porLoja ?? []).map((loja, indice) => (
                <div key={loja.nome} className="flex items-center gap-4 py-4 first:pt-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                    {indice + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{loja.nome}</p>
                    <p className="mt-1 text-sm text-slate-500">{loja.vendas} venda(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{moeda(loja.valor)}</p>
                    <p className="text-xs font-bold text-emerald-700">
                      {moeda(loja.comissao)} comissão
                    </p>
                  </div>
                </div>
              ))}
              {!carregando && (dados?.porLoja.length ?? 0) === 0 ? (
                <p className="py-5 text-sm text-slate-500">Ainda não há lojas identificadas.</p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p className="font-black">Sobre a taxa de conversão</p>
          <p className="mt-1">
            O indicador clique → venda compara as vendas registradas com os cliques humanos
            do mesmo período. Ele é operacional, não uma atribuição perfeita. Quando o parceiro
            fornecer pedido, clickref ou relatório de conversão, poderemos ligar a venda ao canal,
            campanha e item específico com maior precisão.
          </p>
        </section>

        <div className="mt-6">
          <Link
            href="/admin/economize/performance"
            className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            ← Voltar para Consultoria & Conteúdo
          </Link>
        </div>
      </div>
    </main>
  );
}
