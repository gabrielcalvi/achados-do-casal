import RadarPublico from "./RadarPublico";
import PacotesPublicos from "./PacotesPublicos";
import ViagemPorOrcamento from "./ViagemPorOrcamento";
import ExperienciaViagens from "./ExperienciaViagens";

export const dynamic = "force-dynamic";

const GRUPO_VIAGENS = "https://chat.whatsapp.com/LaeDJXjVTnhIpRf8FfR8Xx";

const ORIGENS_MONITORADAS = [
  "Porto Alegre",
  "São Paulo",
  "Rio de Janeiro",
  "Florianópolis",
  "Brasília",
  "Belo Horizonte",
  "Salvador",
  "Recife",
];

export default function ViagensPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-5">
          <a href="/" className="shrink-0">
            <img src="/logo-achados-do-casal.png" alt="Achados do Casal" className="h-12 w-auto object-contain sm:h-14" />
          </a>

          <nav className="ml-auto flex gap-2 overflow-x-auto pb-1">
            <a href="/economize" className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700">Economize</a>
            <span className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-sm">Viagens</span>
            <a href={GRUPO_VIAGENS} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-green-700">WhatsApp Viagens</a>
            <a href="/gamer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800">Gamer</a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.12),transparent_25%),radial-gradient(circle_at_10%_80%,rgba(34,211,238,0.12),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:py-18 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black tracking-wide">INTELIGÊNCIA DE VIAGEM</span>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Viajar melhor,<br />pagar menos<br /><span className="text-cyan-200">e decidir com dados.</span></h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-sky-100">Um Radar que acompanha preços reais, compara oportunidades e ajuda você a escolher melhor antes de comprar.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#radar-real" className="rounded-2xl bg-white px-6 py-4 font-black text-sky-950 shadow-lg transition hover:bg-sky-50">Ver Radar inteligente</a>
              <a href="#viajar-com-orcamento" className="rounded-2xl bg-emerald-400 px-6 py-4 font-black text-emerald-950 shadow-lg transition hover:bg-emerald-300">Tenho um orçamento</a>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-sky-100">
              <a href="#nossas-viagens" className="transition hover:text-white">Nossas viagens</a><span className="text-white/30">•</span>
              <a href={GRUPO_VIAGENS} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">Receber achados no WhatsApp</a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm font-black uppercase tracking-widest text-cyan-200">Nosso Radar de oportunidades</p><h2 className="mt-3 text-3xl font-black">O robô procura.<br />Você escolhe melhor.</h2></div>
              <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs font-black text-cyan-100">8 origens · 160 rotas</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wide text-sky-200">Origens</p><p className="mt-1 text-2xl font-black">8</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wide text-sky-200">Destinos</p><p className="mt-1 text-2xl font-black">20</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wide text-sky-200">Rotas</p><p className="mt-1 text-2xl font-black text-cyan-200">160</p></div>
            </div>
            <p className="mt-5 text-sm leading-6 text-sky-100">Novas rotas entram no ranking assim que recebem a primeira tarifa real. Sem preço inventado e sem favorecer parceiros.</p>
            <div className="mt-5 flex flex-wrap gap-2">{ORIGENS_MONITORADAS.map((origem) => <span key={origem} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white">{origem}</span>)}</div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-12">
          <div className="mb-6 text-center"><span className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Central de Viagens</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">Escolha como você quer começar</h2></div>

          <div className="grid gap-4 lg:grid-cols-3">
            <a href="#radar-real" className="group rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-950 to-blue-800 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Radar Inteligente</p>
              <h3 className="mt-3 text-2xl font-black">Veja as melhores oportunidades agora</h3>
              <p className="mt-3 leading-7 text-sky-100">Preço, classificação, datas e leitura do Radar em um só lugar.</p>
              <span className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-sky-950">Abrir Radar</span>
            </a>

            <a href="#viajar-com-orcamento" className="group rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-cyan-500 p-6 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/70">Viaje pelo seu orçamento</p>
              <h3 className="mt-3 text-2xl font-black">Tenho R$ 10.000. Para onde posso ir?</h3>
              <p className="mt-3 leading-7 text-emerald-950/80">O Radar cruza seu orçamento com as tarifas reais e mostra os melhores encaixes.</p>
              <span className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Simular orçamento</span>
            </a>

            <a href="#nossas-viagens" className="group relative overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <img src="/viagens/familia-times-square.jpg" alt="Família viajando" className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Experiência real</p>
                <h3 className="mt-3 text-2xl font-black">Nossas viagens, roteiros e descobertas</h3>
                <p className="mt-3 leading-7 text-slate-200">Road trips, hospedagens, atrações, acertos e erros vividos na prática.</p>
                <span className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">Conhecer nossa história</span>
              </div>
            </a>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-black text-emerald-950">Quer receber os achados antes?</p><p className="mt-1 text-sm font-semibold text-emerald-800">Entre no grupo de Viagens e acompanhe oportunidades selecionadas.</p></div>
            <a href={GRUPO_VIAGENS} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-700">Entrar no WhatsApp Viagens</a>
          </div>
        </div>
      </section>

      <RadarPublico />
      <ViagemPorOrcamento />
      <PacotesPublicos />
      <ExperienciaViagens />

      <section className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-800 p-7 text-white sm:p-10">
          <h2 className="text-3xl font-black">Independência para encontrar o que vale a pena.</h2>
          <p className="mt-3 max-w-4xl leading-7 text-cyan-50">O Radar e a seleção editorial não dependem de uma única empresa. Parceiros podem viabilizar ofertas e serviços, mas não determinam ranking, score ou classificação das oportunidades.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Achados do Casal • Viagens, economia e experiências reais.</span>
          <a href="/" className="font-bold text-slate-700 hover:text-slate-950">Voltar ao início</a>
        </div>
      </footer>
    </main>
  );
}
