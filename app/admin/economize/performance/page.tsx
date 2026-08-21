"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RespostaPerformance = {
  periodo: { dias: number; inicio: string; fim: string };
  filtro?: { trafego: string; descricao: string };
  resumo: {
    cliques: number;
    sessoes: number;
    cliquesPorSessao: number;
    canaisAtivos: number;
    variacaoCliques: number;
    variacaoSessoes: number;
  };
  diagnostico?: {
    humanoProvavel: number;
    bots: number;
    interno: number;
    naoClassificado: number;
    totalBruto: number;
  };
  origens: Array<{ origem: string; quantidade: number; percentual: number }>;
  topLojas: Array<{ lojaId: string; loja: string; slug: string | null; quantidade: number }>;
  topOfertas: Array<{ ofertaId: string; titulo: string; preco: number | null; loja: string; quantidade: number }>;
  error?: string;
};

const ROTULOS_ORIGEM: Record<string, string> = {
  central_economize: "Central Economize",
  site: "Site",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  admin: "Admin",
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

function variacao(valor: number) {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(1).replace(".0", "")}%`;
}

export default function PerformancePage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RespostaPerformance | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch(`/api/admin/economize/performance?dias=${dias}`, { cache: "no-store" });
        const resultado = (await resposta.json()) as RespostaPerformance;
        if (!resposta.ok) throw new Error(resultado.error || "Não foi possível carregar a performance.");
        if (ativo) setDados(resultado);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : "Erro inesperado.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();
    return () => { ativo = false; };
  }, [dias]);

  const maiorOrigem = useMemo(() => Math.max(1, ...(dados?.origens.map((item) => item.quantidade) ?? [1])), [dados]);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Crescimento e monetização</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">📊 Performance & Distribuição</h1>
              <p className="mt-2 max-w-3xl text-slate-600">As métricas principais agora usam apenas tráfego classificado como humano provável. Bots conhecidos e acessos internos ficam separados para não inflar os números.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setDias(valor)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${dias === valor ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {valor} dias
                </button>
              ))}
            </div>
          </div>
        </header>

        {erro ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{erro}</div> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { titulo: "Cliques humanos", valor: dados?.resumo.cliques ?? 0, detalhe: dados ? variacao(dados.resumo.variacaoCliques) : "—" },
            { titulo: "Sessões humanas", valor: dados?.resumo.sessoes ?? 0, detalhe: dados ? variacao(dados.resumo.variacaoSessoes) : "—" },
            { titulo: "Cliques / sessão", valor: dados?.resumo.cliquesPorSessao ?? 0, detalhe: "engajamento" },
            { titulo: "Canais ativos", valor: dados?.resumo.canaisAtivos ?? 0, detalhe: "origens com clique" },
          ].map((card) => (
            <div key={card.titulo} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">{card.titulo}</p>
              <p className="mt-2 text-3xl font-black">{carregando ? "…" : card.valor}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">{card.detalhe}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { titulo: "Humano provável", valor: dados?.diagnostico?.humanoProvavel ?? 0, detalhe: "entra nas métricas", classe: "border-emerald-200 bg-emerald-50" },
            { titulo: "Bots", valor: dados?.diagnostico?.bots ?? 0, detalhe: "excluídos", classe: "border-amber-200 bg-amber-50" },
            { titulo: "Interno", valor: dados?.diagnostico?.interno ?? 0, detalhe: "admin / testes", classe: "border-blue-200 bg-blue-50" },
            { titulo: "Não classificado", valor: dados?.diagnostico?.naoClassificado ?? 0, detalhe: "fora das métricas", classe: "border-slate-200 bg-white" },
          ].map((card) => (
            <div key={card.titulo} className={`rounded-3xl border p-5 shadow-sm ${card.classe}`}>
              <p className="text-sm font-bold text-slate-600">{card.titulo}</p>
              <p className="mt-2 text-3xl font-black">{carregando ? "…" : card.valor}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">{card.detalhe}</p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-600">Distribuição</p>
                <h2 className="mt-1 text-2xl font-black">Cliques humanos por canal</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">últimos {dias} dias</span>
            </div>

            <div className="mt-6 space-y-4">
              {(dados?.origens ?? []).map((item) => (
                <div key={item.origem}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-black">{ROTULOS_ORIGEM[item.origem] || item.origem}</span>
                    <span className="font-bold text-slate-500">{item.quantidade} · {item.percentual}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(4, (item.quantidade / maiorOrigem) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {!carregando && (dados?.origens.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Ainda não há cliques humanos no período.</p> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-600">O que chama atenção</p>
              <h2 className="mt-1 text-2xl font-black">Top ofertas por clique humano</h2>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.topOfertas ?? []).map((oferta, indice) => (
                <div key={oferta.ofertaId} className="flex gap-4 py-4 first:pt-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">{indice + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{oferta.titulo}</p>
                    <p className="mt-1 text-sm text-slate-500">{oferta.loja}{moeda(oferta.preco) ? ` · ${moeda(oferta.preco)}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">{oferta.quantidade}</p>
                    <p className="text-xs font-bold uppercase text-slate-400">cliques</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-violet-600">Parceiros</p>
              <h2 className="mt-1 text-2xl font-black">Lojas com mais cliques humanos</h2>
            </div>
            <Link href="/admin/economize" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Voltar à Central</Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(dados?.topLojas ?? []).slice(0, 5).map((loja) => (
              <div key={loja.lojaId} className="rounded-2xl bg-slate-50 p-4">
                <p className="truncate text-sm font-black">{loja.loja}</p>
                <p className="mt-2 text-3xl font-black">{loja.quantidade}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">cliques humanos</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
