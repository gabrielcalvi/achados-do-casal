"use client";

import { useEffect, useMemo, useState } from "react";

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

type RespostaRadar = {
  sucesso: boolean;
  resultados: Resultado[];
  totalDestinosMonitorados: number;
  destinosComDados: number;
  destinosEmColeta: DestinoEmColeta[];
  erro?: string;
};

const ORIGENS = [
  { codigo: "POA", nome: "Porto Alegre" },
  { codigo: "GRU", nome: "São Paulo" },
  { codigo: "GIG", nome: "Rio de Janeiro" },
  { codigo: "FLN", nome: "Florianópolis" },
  { codigo: "BSB", nome: "Brasília" },
  { codigo: "CNF", nome: "Belo Horizonte" },
  { codigo: "SSA", nome: "Salvador" },
  { codigo: "REC", nome: "Recife" },
] as const;

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function dataCurta(valor: string | null) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${valor}T12:00:00Z`));
}

function prioridadeClassificacao(classificacao: string) {
  const texto = classificacao.toLowerCase();
  if (texto.includes("absurdo")) return 5;
  if (texto.includes("muito bom") || texto.includes("preço bom")) return 4;
  if (texto.includes("interessante")) return 3;
  if (texto.includes("comum")) return 2;
  return 1;
}

function estiloClassificacao(classificacao: string) {
  const texto = classificacao.toLowerCase();
  if (texto.includes("absurdo")) return "border-emerald-300 bg-emerald-500 text-white";
  if (texto.includes("muito bom") || texto.includes("preço bom")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (texto.includes("interessante")) return "border-cyan-200 bg-cyan-50 text-cyan-800";
  if (texto.includes("comum")) return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function RadarPublico() {
  const [origem, setOrigem] = useState("POA");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [destinosEmColeta, setDestinosEmColeta] = useState<DestinoEmColeta[]>([]);
  const [totalDestinos, setTotalDestinos] = useState(20);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("TODOS");

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function carregar(silencioso = false) {
      if (!silencioso) setCarregando(true);
      setErro("");

      try {
        const params = new URLSearchParams({
          origem,
          orcamento: "999999",
          viajantes: "1",
        });

        const resposta = await fetch(`/api/viagens/orcamento?${params.toString()}`, {
          cache: "no-store",
        });
        const dados = (await resposta.json()) as RespostaRadar;

        if (!resposta.ok || !dados?.sucesso) {
          throw new Error(dados?.erro || "Não foi possível consultar o Radar.");
        }

        if (!ativo) return;

        const ordenados = [...(dados.resultados || [])].sort((a, b) => {
          const prioridade = prioridadeClassificacao(b.classificacao) - prioridadeClassificacao(a.classificacao);
          if (prioridade !== 0) return prioridade;
          return a.precoPorPessoa - b.precoPorPessoa;
        });
        const emColeta = dados.destinosEmColeta || [];
        const monitorados = new Set([
          ...ordenados.map((item) => item.destinoCodigo),
          ...emColeta.map((item) => item.codigo),
        ]);

        setResultados(ordenados);
        setDestinosEmColeta(emColeta);
        setTotalDestinos(Number(dados.totalDestinosMonitorados || monitorados.size || 20));
        setFiltroDestino((atual) => atual === "TODOS" || monitorados.has(atual) ? atual : "TODOS");
      } catch (error) {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Radar indisponível.");
      } finally {
        if (ativo && !silencioso) setCarregando(false);
      }
    }

    setFiltroDestino("TODOS");
    carregar();

    timer = setInterval(() => carregar(true), 5 * 60 * 1000);

    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
    };
  }, [origem]);

  const origemNome = useMemo(
    () => ORIGENS.find((item) => item.codigo === origem)?.nome || origem,
    [origem]
  );

  const destinosDisponiveis = useMemo(() => {
    const mapa = new Map<string, { nome: string; temDados: boolean }>();

    resultados.forEach((item) => {
      mapa.set(item.destinoCodigo, { nome: item.destino, temDados: true });
    });

    destinosEmColeta.forEach((item) => {
      if (!mapa.has(item.codigo)) {
        mapa.set(item.codigo, { nome: item.nome, temDados: false });
      }
    });

    return Array.from(mapa.entries())
      .map(([codigo, dados]) => ({ codigo, ...dados }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [resultados, destinosEmColeta]);

  const destinoSelecionado = useMemo(
    () => destinosDisponiveis.find((item) => item.codigo === filtroDestino) || null,
    [destinosDisponiveis, filtroDestino]
  );

  const resultadosFiltrados = useMemo(
    () => filtroDestino === "TODOS" ? resultados : resultados.filter((item) => item.destinoCodigo === filtroDestino),
    [resultados, filtroDestino]
  );

  const topResultados = resultadosFiltrados.slice(0, 6);
  const melhor = topResultados[0] || null;

  return (
    <section id="radar-real" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-900/10">
          <div className="relative overflow-hidden px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.22),transparent_30%),radial-gradient(circle_at_0%_100%,rgba(14,165,233,0.18),transparent_30%)]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Radar inteligente</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">Atualização automática 4x/dia</span>
                </div>
                <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">Onde existe uma oportunidade<span className="block text-cyan-300">saindo da sua cidade agora?</span></h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">O Radar acompanha preços reais, classifica cada rota pela própria régua e destaca primeiro o que merece atenção de verdade.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Origens</p><p className="mt-1 text-2xl font-black">8</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Destinos</p><p className="mt-1 text-2xl font-black text-cyan-300">{totalDestinos}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Com dados</p><p className="mt-1 text-2xl font-black text-emerald-300">{resultados.length}</p></div>
              </div>
            </div>

            <div className="relative mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Saindo de</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ORIGENS.map((item) => (
                  <button key={item.codigo} type="button" onClick={() => setOrigem(item.codigo)} className={`rounded-full border px-4 py-2.5 text-sm font-black transition ${origem === item.codigo ? "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-300/10"}`}>
                    {item.nome}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Top oportunidades agora</p>
                <h3 className="mt-2 text-3xl font-black text-slate-950">Saindo de {origemNome}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">Promoções primeiro; dentro da mesma faixa, menor preço primeiro.</p>
              </div>

              {melhor ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Melhor leitura do Radar</p>
                  <p className="mt-1 text-xl font-black text-emerald-950">{melhor.destino}</p>
                </div>
              ) : null}
            </div>

            {!carregando && !erro && destinosDisponiveis.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Filtrar por destino</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Todos os destinos monitorados aparecem aqui. Os que ainda não receberam tarifa real ficam identificados como “em coleta”.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500">atualiza sozinho a cada 5 min</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFiltroDestino("TODOS")} className={`rounded-full border px-3 py-2 text-xs font-black transition ${filtroDestino === "TODOS" ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"}`}>
                    Todos ({totalDestinos})
                  </button>

                  {destinosDisponiveis.map((destino) => (
                    <button
                      key={destino.codigo}
                      type="button"
                      onClick={() => setFiltroDestino(destino.codigo)}
                      className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                        filtroDestino === destino.codigo
                          ? destino.temDados
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-amber-500 bg-amber-500 text-white"
                          : destino.temDados
                            ? "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"
                      }`}
                    >
                      {destino.nome}{!destino.temDados ? " · em coleta" : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {carregando ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-3xl bg-slate-100" />)}</div>
            ) : erro ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{erro}</div>
            ) : topResultados.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <p className="font-black text-amber-950">
                  {destinoSelecionado ? `Ainda não temos uma tarifa real recente para ${destinoSelecionado.nome}.` : "Esta origem já está cadastrada no Radar."}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">A rota continua monitorada e entra automaticamente nas oportunidades assim que uma tarifa real válida for gravada.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {topResultados.map((item, index) => {
                  const ida = dataCurta(item.ida);
                  const volta = dataCurta(item.volta);

                  return (
                    <article key={item.radarId} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl">
                      {index === 0 ? <span className="absolute right-0 top-0 rounded-bl-2xl bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white">Destaque do Radar</span> : null}
                      <div className="flex items-start justify-between gap-3 pr-20">
                        <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{origem} → {item.destinoCodigo}</p><h4 className="mt-1 text-2xl font-black text-slate-950">{item.destino}</h4></div>
                      </div>

                      <div className="mt-5 flex items-end justify-between gap-3">
                        <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Melhor tarifa recente</p><p className="mt-1 text-3xl font-black text-slate-950">{moeda(item.precoPorPessoa)}</p><p className="text-xs font-bold text-slate-400">por pessoa</p></div>
                        <span className={`rounded-full border px-3 py-2 text-xs font-black ${estiloClassificacao(item.classificacao)}`}>{item.classificacao}</span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 text-sm font-bold text-slate-600">
                        {ida && volta ? <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Datas</p><p className="mt-1">{ida} → {volta}</p></div> : null}
                        <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Permanência</p><p className="mt-1">{item.permanenciaDias ? `${item.permanenciaDias} dias` : "Flexível"}</p></div>
                      </div>

                      {item.ciaAerea ? <p className="mt-4 text-sm font-bold text-slate-500">Companhia: <span className="text-slate-800">{item.ciaAerea}</span></p> : null}

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                        {item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">Ver passagem</a> : null}
                        <a href="#viajar-com-orcamento" className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 transition hover:bg-cyan-100">Simular orçamento</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {destinosEmColeta.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-800">Ainda recebendo a primeira tarifa real</p>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500">{destinosEmColeta.length} destinos</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {destinosEmColeta.map((destino) => <span key={destino.codigo} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">{destino.nome}</span>)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
