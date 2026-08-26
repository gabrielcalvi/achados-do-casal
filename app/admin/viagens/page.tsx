import Link from "next/link";
import PacotesViagem from "./PacotesViagem";
import PacotesDisponibilidade from "./PacotesDisponibilidade";
import CapturadorDecolarLocal from "./CapturadorDecolarLocal";
import DemandaRadar from "./DemandaRadar";
import IngressosViagem from "./IngressosViagem";

export const dynamic = "force-dynamic";

type RadarStatus = {
  slug: string;
  nome: string;
  origem: string;
  destino: string;
  observacoes: number;
  ultimaAtualizacao: string | null;
  melhorPreco: number | null;
  moeda: string;
  faixa: string | null;
  erro?: string;
};

const RADARES = [
  "poa-orlando",
  "poa-new-york",
  "poa-miami",
  "poa-los-angeles",
  "poa-lisboa",
  "gru-orlando",
  "gru-new-york",
  "gru-miami",
  "gru-los-angeles",
  "gru-lisboa",
  "gru-madrid",
  "gig-orlando",
  "gig-new-york",
  "gig-miami",
  "gig-los-angeles",
  "gig-lisboa",
] as const;

function formatarPreco(valor: number | null, moeda = "BRL") {
  if (!Number.isFinite(valor)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda, maximumFractionDigits: 0 }).format(valor as number);
}

function formatarData(valor: string | null) {
  if (!valor) return "Sem atualização";
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function carregarRadar(slug: string): Promise<RadarStatus> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "achadosdocasal.com.br";
    const origem = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
    const resposta = await fetch(`${origem}/api/viagens/radar/destaque?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const dados = await resposta.json();

    if (!resposta.ok || !dados?.sucesso) throw new Error(dados?.erro || "Não foi possível carregar o radar.");

    return {
      slug,
      nome: String(dados.radar?.nome || slug),
      origem: String(dados.radar?.origem || "—"),
      destino: String(dados.radar?.destino || "—"),
      observacoes: Number(dados.observacoes || 0),
      ultimaAtualizacao: typeof dados.ultimaAtualizacao === "string" ? dados.ultimaAtualizacao : null,
      melhorPreco: Number.isFinite(Number(dados.melhor?.precoPorPessoa)) ? Number(dados.melhor.precoPorPessoa) : null,
      moeda: String(dados.melhor?.moeda || "BRL"),
      faixa: typeof dados.melhor?.tituloFaixa === "string" ? dados.melhor.tituloFaixa : null,
    };
  } catch (error) {
    return {
      slug,
      nome: slug,
      origem: slug.split("-")[0]?.toUpperCase() || "—",
      destino: "—",
      observacoes: 0,
      ultimaAtualizacao: null,
      melhorPreco: null,
      moeda: "BRL",
      faixa: null,
      erro: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }
}

export default async function AdminViagensPage() {
  const radares = await Promise.all(RADARES.map((slug) => carregarRadar(slug)));
  const comDados = radares.filter((radar) => !radar.erro);
  const comErro = radares.length - comDados.length;
  const totalObservacoes = comDados.reduce((total, radar) => total + radar.observacoes, 0);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-violet-600">Achados do Casal</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">✈️ Viagens — Radar + Pacotes + Ingressos</h1>
              <p className="mt-2 max-w-3xl text-slate-600">O Radar encontra boas janelas de voo. Pacotes cuidam de aéreo + hotel; ingressos e atrações têm cadastro próprio, sem exigir origem, destino ou hospedagem.</p>
            </div>
            <Link href="/viagens" target="_blank" className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700">Abrir página pública ↗</Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Radares configurados</p><p className="mt-2 text-3xl font-black">{radares.length}</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Radares respondendo</p><p className="mt-2 text-3xl font-black text-emerald-600">{comDados.length}</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Falhas de leitura</p><p className={`mt-2 text-3xl font-black ${comErro > 0 ? "text-red-600" : "text-emerald-600"}`}>{comErro}</p></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Observações acumuladas</p><p className="mt-2 text-3xl font-black">{totalObservacoes.toLocaleString("pt-BR")}</p></div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div><h2 className="text-2xl font-black">Status dos 16 radares</h2><p className="mt-1 text-sm text-slate-500">Dados lidos diretamente do mesmo endpoint usado na página pública.</p></div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-black">Radar</th><th className="px-4 py-3 font-black">Rota</th><th className="px-4 py-3 font-black">Observações</th><th className="px-4 py-3 font-black">Melhor preço</th><th className="px-4 py-3 font-black">Classificação</th><th className="px-4 py-3 font-black">Última atualização</th><th className="px-4 py-3 font-black">Status</th></tr></thead>
              <tbody>
                {radares.map((radar) => (
                  <tr key={radar.slug} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold text-slate-900">{radar.nome}<div className="text-xs font-medium text-slate-400">{radar.slug}</div></td>
                    <td className="px-4 py-3 font-bold">{radar.origem} → {radar.destino}</td>
                    <td className="px-4 py-3">{radar.observacoes.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-black">{formatarPreco(radar.melhorPreco, radar.moeda)}</td>
                    <td className="px-4 py-3">{radar.faixa || "—"}</td>
                    <td className="px-4 py-3">{formatarData(radar.ultimaAtualizacao)}</td>
                    <td className="px-4 py-3">{radar.erro ? <span className="font-bold text-red-600" title={radar.erro}>❌ Erro</span> : <span className="font-bold text-emerald-600">● Online</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <DemandaRadar />
        <CapturadorDecolarLocal />
        <PacotesDisponibilidade />
        <IngressosViagem />
        <PacotesViagem />
      </div>
    </main>
  );
}
