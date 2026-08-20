"use client";

import { useMemo, useState } from "react";

type Resultado = {
  radarId: string;
  slug: string;
  destinoCodigo: string;
  destino: string;
  precoPorPessoa: number;
  totalPassagens: number;
  sobra: number;
  cabeNoOrcamento: boolean;
  percentualOrcamento: number;
  classificacao: string;
  ida: string | null;
  volta: string | null;
  permanenciaDias: number | null;
  ciaAerea: string | null;
  escalasIda: number | null;
  escalasVolta: number | null;
  score: number | null;
  link: string | null;
  observadoEm: string | null;
};

type DestinoEmColeta = { codigo: string; nome: string };

const ORIGENS = [
  { codigo: "POA", nome: "Porto Alegre" },
  { codigo: "GRU", nome: "São Paulo" },
  { codigo: "GIG", nome: "Rio de Janeiro" },
];

const ORCAMENTOS_RAPIDOS = [5000, 8000, 10000, 15000, 20000];

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function dataCurta(valor: string | null) {
  if (!valor) return null;
  return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function classeFaixa(classificacao: string) {
  const texto = classificacao.toLowerCase();
  if (texto.includes("absurdo")) return "bg-emerald-600 text-white";
  if (texto.includes("muito bom")) return "bg-emerald-100 text-emerald-800";
  if (texto.includes("interessante")) return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

export default function ViagemPorOrcamento() {
  const [origem, setOrigem] = useState("POA");
  const [orcamento, setOrcamento] = useState("10000");
  const [viajantes, setViajantes] = useState("2");
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [destinosEmColeta, setDestinosEmColeta] = useState<DestinoEmColeta[]>([]);
  const [totalDestinos, setTotalDestinos] = useState(0);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState("");

  const numeroOrcamento = useMemo(() => Number(orcamento.replace(/\D/g, "")) || 0, [orcamento]);
  const qtdViajantes = Number(viajantes) || 1;

  async function buscar() {
    if (numeroOrcamento <= 0) {
      setErro("Informe um orçamento válido.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const params = new URLSearchParams({
        origem,
        orcamento: String(numeroOrcamento),
        viajantes,
      });
      const resposta = await fetch(`/api/viagens/orcamento?${params.toString()}`, { cache: "no-store" });
      const dados = await resposta.json();

      if (!resposta.ok || !dados?.sucesso) throw new Error(dados?.erro || "Não foi possível consultar o Radar.");

      setResultados(dados.resultados || []);
      setDestinosEmColeta(dados.destinosEmColeta || []);
      setTotalDestinos(Number(dados.totalDestinosMonitorados || 0));
      setBuscou(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao consultar o Radar.");
    } finally {
      setCarregando(false);
    }
  }

  const resultadosQueCabem = resultados.filter((item) => item.cabeNoOrcamento);
  const melhorResultado = resultadosQueCabem[0] || resultados[0] || null;

  return (
    <section id="viajar-com-orcamento" className="relative overflow-hidden border-y border-slate-200 bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.24),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(16,185,129,0.18),transparent_28%)]" />

      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Radar de orçamento</span>
            <h2 className="mt-5 max-w-2xl text-4xl font-black leading-[1.05] sm:text-5xl">
              Diga quanto você tem.
              <span className="block text-cyan-300">O Radar mostra até onde dá para ir.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Informe a cidade de saída, o orçamento total e quantas pessoas vão viajar. A gente cruza isso com preços reais encontrados pelos nossos radares.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Origem</p><p className="mt-1 text-xl font-black">{origem}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Orçamento</p><p className="mt-1 text-xl font-black text-cyan-300">{moeda(numeroOrcamento || 0)}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Viajantes</p><p className="mt-1 text-xl font-black">{qtdViajantes}</p></div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-black/20 sm:p-6 lg:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Monte o cenário</p><h3 className="mt-1 text-2xl font-black">Quanto você quer gastar na viagem?</h3></div>
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Dados reais do Radar</span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">Saindo de
                <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-slate-950 outline-none focus:border-sky-400 focus:bg-white">
                  {ORIGENS.map((item) => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">Orçamento total
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span><input inputMode="numeric" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="10000" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-black text-slate-950 outline-none focus:border-sky-400 focus:bg-white" /></div>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">Viajantes com assento
                <select value={viajantes} onChange={(e) => setViajantes(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold text-slate-950 outline-none focus:border-sky-400 focus:bg-white">
                  {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "pessoa" : "pessoas"}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ORCAMENTOS_RAPIDOS.map((valor) => <button key={valor} type="button" onClick={() => setOrcamento(String(valor))} className={`rounded-full px-3 py-2 text-xs font-black transition ${numeroOrcamento === valor ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{moeda(valor)}</button>)}
            </div>

            <button type="button" onClick={buscar} disabled={carregando} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-4 text-lg font-black text-white shadow-lg shadow-sky-200 transition hover:from-sky-700 hover:to-cyan-600 disabled:opacity-60">
              {carregando ? "Consultando os radares..." : "Descobrir para onde eu posso ir"}
            </button>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">Nesta etapa, o cálculo usa o valor das passagens. Hospedagem, carro e passeios entram na próxima camada de custo total.</div>
            {erro ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</p> : null}
          </div>
        </div>

        {buscou ? (
          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Resultado do Radar</p><h3 className="mt-2 text-3xl font-black">Melhores encaixes para {moeda(numeroOrcamento)}</h3><p className="mt-2 text-slate-300">{resultadosQueCabem.length} destino(s) já cabem nas passagens para {qtdViajantes} viajante(s).</p></div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{totalDestinos || 20} destinos monitorados</span><span className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200">{destinosEmColeta.length} ainda recebendo primeira coleta</span></div>
            </div>

            {melhorResultado ? <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3"><p className="text-xs font-black uppercase tracking-wide text-emerald-200">Melhor encaixe agora</p><p className="mt-1 text-xl font-black">{melhorResultado.destino}</p></div> : null}

            {resultados.length === 0 ? <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 font-bold text-slate-300">Os 20 destinos estão cadastrados, mas esta origem ainda está aguardando as primeiras coletas reais.</div> : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {resultados.slice(0, 10).map((item, index) => {
                  const ida = dataCurta(item.ida); const volta = dataCurta(item.volta); const dentro = item.cabeNoOrcamento;
                  return <article key={item.radarId} className={`relative overflow-hidden rounded-3xl border p-5 text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${dentro ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-100"}`}>
                    {index === 0 && dentro ? <div className="absolute right-0 top-0 rounded-bl-2xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white">Melhor encaixe</div> : null}
                    <div className="flex items-start justify-between gap-4 pr-20"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{origem} → {item.destinoCodigo}</p><h4 className="mt-1 text-2xl font-black">{item.destino}</h4></div><span className={`rounded-full px-3 py-2 text-xs font-black ${classeFaixa(item.classificacao)}`}>{item.classificacao}</span></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Por pessoa</p><p className="mt-1 text-xl font-black">{moeda(item.precoPorPessoa)}</p></div><div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Total passagens</p><p className="mt-1 text-xl font-black">{moeda(item.totalPassagens)}</p></div><div className={`rounded-2xl border p-4 ${dentro ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Saldo do orçamento</p><p className={`mt-1 text-xl font-black ${dentro ? "text-emerald-700" : "text-red-600"}`}>{moeda(item.sobra)}</p></div></div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${dentro ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${Math.min(100, Math.max(4, item.percentualOrcamento))}%` }} /></div><p className="mt-2 text-xs font-bold text-slate-400">As passagens usam {Math.round(item.percentualOrcamento)}% do orçamento informado.</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-600">{ida && volta ? <span className="rounded-full bg-slate-100 px-3 py-2">{ida} → {volta}</span> : null}{item.permanenciaDias ? <span className="rounded-full bg-slate-100 px-3 py-2">{item.permanenciaDias} dias</span> : null}{item.ciaAerea ? <span className="rounded-full bg-slate-100 px-3 py-2">{item.ciaAerea}</span> : null}</div>
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">{item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Ver passagem</a> : null}<a href="https://chat.whatsapp.com/LaeDJXjVTnhIpRf8FfR8Xx" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">Receber oportunidades</a></div>
                  </article>;
                })}
              </div>
            )}

            {destinosEmColeta.length > 0 ? <div className="mt-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-5"><p className="text-sm font-black text-cyan-200">Também estamos monitorando:</p><div className="mt-3 flex flex-wrap gap-2">{destinosEmColeta.map((d) => <span key={d.codigo} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">{d.nome}</span>)}</div><p className="mt-3 text-xs text-slate-400">Eles entram automaticamente no ranking assim que receberem a primeira tarifa real.</p></div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
