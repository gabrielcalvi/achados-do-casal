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

const ORIGENS = [
  { codigo: "POA", nome: "Porto Alegre" },
  { codigo: "GRU", nome: "São Paulo" },
  { codigo: "GIG", nome: "Rio de Janeiro" },
];

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

export default function ViagemPorOrcamento() {
  const [origem, setOrigem] = useState("POA");
  const [orcamento, setOrcamento] = useState("10000");
  const [viajantes, setViajantes] = useState("2");
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState("");

  const numeroOrcamento = useMemo(() => Number(orcamento.replace(/\D/g, "")) || 0, [orcamento]);

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
      const resposta = await fetch(`/api/viagens/orcamento?${params.toString()}`, {
        cache: "no-store",
      });
      const dados = await resposta.json();

      if (!resposta.ok || !dados?.sucesso) throw new Error(dados?.erro || "Não foi possível consultar o Radar.");

      setResultados(dados.resultados || []);
      setBuscou(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao consultar o Radar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section id="viajar-com-orcamento" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-emerald-600">
              Seu dinheiro decide junto com o Radar
            </span>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Tenho R$ 10.000. Para onde posso ir?</h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Informe sua cidade de saída, orçamento e número de viajantes. O Radar compara as melhores passagens que já encontrou e mostra onde o valor cabe melhor hoje.
            </p>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              Primeira versão: a conta considera as passagens. A próxima camada vai somar hospedagem e outros custos para chegar ao custo total da viagem.
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Saindo de
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-950"
                >
                  {ORIGENS.map((item) => (
                    <option key={item.codigo} value={item.codigo}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Orçamento total
                <input
                  inputMode="numeric"
                  value={orcamento}
                  onChange={(e) => setOrcamento(e.target.value)}
                  placeholder="10000"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-950"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Viajantes com assento
                <select
                  value={viajantes}
                  onChange={(e) => setViajantes(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-950"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={buscar}
              disabled={carregando}
              className="mt-5 w-full rounded-xl bg-sky-700 px-5 py-4 text-lg font-black text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Consultando o Radar..." : "Descobrir para onde meu orçamento alcança"}
            </button>

            {erro ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</p> : null}
          </div>
        </div>

        {buscou ? (
          <div className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-slate-500">Resultado do Radar</p>
                <h3 className="mt-1 text-2xl font-black">Melhores encaixes para {moeda(numeroOrcamento)}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                {resultados.filter((item) => item.cabeNoOrcamento).length} destino(s) cabem nas passagens
              </span>
            </div>

            {resultados.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 font-bold text-slate-600">
                Ainda não há dados recentes suficientes para essa origem.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {resultados.slice(0, 6).map((item) => {
                  const ida = dataCurta(item.ida);
                  const volta = dataCurta(item.volta);
                  return (
                    <article
                      key={item.radarId}
                      className={`rounded-3xl border p-5 ${
                        item.cabeNoOrcamento
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">{origem} → {item.destinoCodigo}</p>
                          <h4 className="mt-1 text-2xl font-black">{item.destino}</h4>
                        </div>
                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm">
                          {item.classificacao}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase text-slate-400">Por pessoa</p>
                          <p className="mt-1 text-xl font-black">{moeda(item.precoPorPessoa)}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase text-slate-400">Passagens</p>
                          <p className="mt-1 text-xl font-black">{moeda(item.totalPassagens)}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase text-slate-400">Sobra do orçamento</p>
                          <p className={`mt-1 text-xl font-black ${item.sobra >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {moeda(item.sobra)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                        {ida && volta ? <span className="rounded-full bg-white px-3 py-2">{ida} → {volta}</span> : null}
                        {item.permanenciaDias ? <span className="rounded-full bg-white px-3 py-2">{item.permanenciaDias} dias</span> : null}
                        {item.ciaAerea ? <span className="rounded-full bg-white px-3 py-2">{item.ciaAerea}</span> : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                          >
                            Ver passagem
                          </a>
                        ) : null}
                        <a
                          href="https://chat.whatsapp.com/LaeDJXjVTnhIpRf8FfR8Xx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white"
                        >
                          Receber oportunidades no grupo
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
