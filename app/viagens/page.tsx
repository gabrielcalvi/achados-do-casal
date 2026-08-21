import RadarPublico from "./RadarPublico";
import PacotesPublicos from "./PacotesPublicos";
import ViagemPorOrcamento from "./ViagemPorOrcamento";
import ExperienciaViagens from "./ExperienciaViagensV2";

export const dynamic = "force-dynamic";

const GRUPO_VIAGENS = "https://chat.whatsapp.com/LaeDJXjVTnhIpRf8FfR8Xx";

const ORIGENS_MONITORADAS = [
  "Porto Alegre", "São Paulo", "Rio de Janeiro", "Florianópolis",
  "Brasília", "Belo Horizonte", "Salvador", "Recife",
];

export default function ViagensPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-5">
          <a href="/" className="shrink-0"><img src="/logo-achados-do-casal.png" alt="Achados do Casal" className="h-12 w-auto object-contain sm:h-14" /></a>
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

        <div className="travel-plane-wrap pointer-events-none absolute left-[-10vw] top-[82%] z-[1]" aria-hidden="true">
          <span className="travel-plane-trail absolute right-8 top-1/2 block h-px w-36 origin-right" />
          <svg
            viewBox="0 0 64 64"
            className="travel-plane h-10 w-10 sm:h-12 sm:w-12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M58.2 27.7 38.9 18l-8.2-12.2c-.8-1.2-2.3-1.8-3.7-1.4l-2.7.8 4.9 14.9-14.8 4.2-7.8-6.1-3.7 1.1 5.8 10.1-3.8 10.9 3.8-1.1 5.5-8.6 15.1-1.9-1.7 15.6 2.8-.8c1.4-.4 2.5-1.6 2.6-3.1l1.6-14.5 21.2-1.6c2.9-.2 5.2-2.7 5.1-5.6-.1-1.9-1.1-3.6-2.7-4.5Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:py-18 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:py-20">
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

        <style>{`
          .travel-plane-wrap {
            --plane-mid-rise: -20vh;
            --plane-end-rise: -46vh;
            animation: travel-plane-flight 24s linear infinite;
            color: rgba(255, 255, 255, 0.52);
            opacity: 0;
            will-change: transform, opacity;
          }

          .travel-plane {
            filter: drop-shadow(0 0 12px rgba(165, 243, 252, 0.22));
            transform: rotate(-13deg);
          }

          .travel-plane-trail {
            background: linear-gradient(90deg, transparent, rgba(186, 230, 253, 0.16), rgba(255, 255, 255, 0.38));
            transform: rotate(-13deg);
          }

          @keyframes travel-plane-flight {
            0% {
              opacity: 0;
              transform: translate3d(0, 0, 0) scale(0.9);
            }
            7% {
              opacity: 1;
            }
            45% {
              opacity: 1;
              transform: translate3d(60vw, var(--plane-mid-rise), 0) scale(1);
            }
            88% {
              opacity: 1;
            }
            100% {
              opacity: 0;
              transform: translate3d(125vw, var(--plane-end-rise), 0) scale(1.06);
            }
          }

          @media (max-width: 640px) {
            .travel-plane-wrap {
              --plane-mid-rise: -14vh;
              --plane-end-rise: -32vh;
              top: 74%;
              animation-duration: 18s;
              color: rgba(255, 255, 255, 0.62);
            }

            .travel-plane {
              width: 2.75rem;
              height: 2.75rem;
            }

            .travel-plane-trail {
              width: 5.5rem;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .travel-plane-wrap {
              left: auto;
              right: 8%;
              top: 68%;
              opacity: 0.52;
              animation: none;
              transform: rotate(-8deg);
            }
          }
        `}</style>
      </section>

      <RadarPublico />
      <ViagemPorOrcamento />
      <PacotesPublicos />
      <ExperienciaViagens />

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Achados do Casal • Viagens, economia e experiências reais.</span>
          <a href="/" className="font-bold text-slate-700 hover:text-slate-950">Voltar ao início</a>
        </div>
      </footer>
    </main>
  );
}