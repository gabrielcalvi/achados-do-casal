import RadarPublico from "./RadarPublico";
import PacotesPublicos from "./PacotesPublicos";

export const dynamic = "force-dynamic";

export default function ViagensPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-5">
          <a href="/" className="shrink-0">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </a>

          <nav className="ml-auto flex gap-2 overflow-x-auto pb-1">
            <a
              href="/economize"
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              💰 Economize
            </a>
            <span className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-sm">
              ✈️ Viagens
            </span>
            <a
              href="/gamer"
              className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
            >
              🎮 Gamer
            </a>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-700 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black">
              ✈️ INTELIGÊNCIA DE VIAGEM
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Viajar melhor,
              <br />
              pagar menos
              <br />
              e aproveitar mais.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-sky-100">
              Radar de passagens, oportunidades e experiências reunidos com
              informação prática para ajudar você a decidir melhor antes de comprar.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#radar-real"
                className="rounded-xl bg-white px-6 py-4 font-black text-sky-950 transition hover:bg-sky-50"
              >
                🔥 Ver Radar inteligente
              </a>
              <a
                href="#nossas-viagens"
                className="rounded-xl border border-white/30 bg-white/10 px-6 py-4 font-black transition hover:bg-white/15"
              >
                🌎 Nossas viagens
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur sm:p-7">
            <p className="text-sm font-black uppercase tracking-widest text-cyan-200">
              Nosso radar de oportunidades
            </p>
            <h2 className="mt-3 text-3xl font-black">
              O robô procura.
              <br />
              A gente ajuda você a decidir.
            </h2>

            <div className="mt-7 grid gap-3">
              {["Porto Alegre", "São Paulo", "Rio de Janeiro"].map((origem) => (
                <div key={origem} className="rounded-2xl bg-white/10 p-4">
                  <strong>📍 {origem}</strong>
                  <p className="mt-1 text-sm text-sky-100">
                    Monitoramento de rotas e oportunidades saindo desta origem.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RadarPublico />
      <PacotesPublicos />

      <section id="nossas-viagens" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
          <span className="text-sm font-black uppercase tracking-widest text-amber-600">
            Experiência real
          </span>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Nossas Viagens</h2>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
            Este espaço reúne experiências reais viajando em família: destinos,
            road trips, hospedagens, atrações, restaurantes, compras, transporte,
            acertos, erros e descobertas.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <article className="rounded-3xl bg-slate-950 p-7 text-white">
              <div className="text-4xl">🌎</div>
              <h3 className="mt-4 text-2xl font-black">Relatos de viagem</h3>
              <p className="mt-3 leading-7 text-slate-300">
                Experiências reais, cidades, países e passeios que vivemos.
              </p>
              <span className="mt-6 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs font-bold">
                Em construção
              </span>
            </article>

            <article className="rounded-3xl bg-red-600 p-7 text-white">
              <div className="text-4xl">🎥</div>
              <h3 className="mt-4 text-2xl font-black">Vlogs</h3>
              <p className="mt-3 leading-7 text-red-50">
                Vídeos, passeios, road trips e bastidores das nossas viagens.
              </p>
              <span className="mt-6 inline-flex rounded-full bg-white/15 px-3 py-2 text-xs font-bold">
                Em construção
              </span>
            </article>

            <article className="rounded-3xl bg-amber-400 p-7 text-slate-950">
              <div className="text-4xl">🗺️</div>
              <h3 className="mt-4 text-2xl font-black">Guias e roteiros</h3>
              <p className="mt-3 leading-7 text-slate-800">
                Roteiros, atrações, hospedagem, transporte e dicas práticas.
              </p>
              <span className="mt-6 inline-flex rounded-full bg-black/10 px-3 py-2 text-xs font-bold">
                Em construção
              </span>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-800 p-7 text-white sm:p-10">
          <h2 className="text-3xl font-black">Independência para encontrar o que vale a pena.</h2>
          <p className="mt-3 max-w-4xl leading-7 text-cyan-50">
            O Radar e a seleção editorial não dependem de uma única empresa. Parceiros
            podem viabilizar ofertas e serviços, mas não determinam ranking, score ou
            classificação das oportunidades.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Achados do Casal • Viagens, economia e experiências reais.</span>
          <a href="/" className="font-bold text-slate-700 hover:text-slate-950">
            Voltar ao início
          </a>
        </div>
      </footer>
    </main>
  );
}
