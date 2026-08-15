import RadarPublico from "./RadarPublico";
import PacotesPublicos from "./PacotesPublicos";

export const dynamic = "force-dynamic";

const categorias = [
  {
    icone: "✈️",
    titulo: "Voos",
    texto: "Passagens e oportunidades aéreas selecionadas."
  },
  {
    icone: "🏨",
    titulo: "Hotéis",
    texto: "Hospedagens, resorts e condições especiais."
  },
  {
    icone: "🧳",
    titulo: "Pacotes",
    texto: "Combinações de voo, hotel e experiências."
  },
  {
    icone: "🚗",
    titulo: "Carros",
    texto: "Ofertas para aluguel de veículos."
  },
  {
    icone: "🎟️",
    titulo: "Cupons",
    texto: "Cupons oficiais disponibilizados pelos parceiros."
  },
  {
    icone: "🔥",
    titulo: "Promoções",
    texto: "Campanhas e oportunidades encontradas pelo nosso robô."
  }
];

export default function ViagensPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">

            <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4 lg:flex-nowrap">

          <a href="/" className="shrink-0">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-14 w-auto object-contain"
            />
          </a>

          <div className="flex-1" />

          <nav className="flex flex-wrap items-center justify-end gap-2">

            <a
              href="/economize"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              💰 Economize
            </a>

            <span className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-sm">
              ✈️ Viagens
            </span>

            <a
              href="https://www.instagram.com/achadosdocasal26/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white transition hover:bg-pink-600"
            >
              Instagram
            </a>

            <a
              href="https://chat.whatsapp.com/DMC6VCIcuMBJMfbfdIk8SZ?s=sh&p=i&ilr=4&amv=0"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-700"
            >
              WhatsApp
            </a>

            <a
              href="/gamer"
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              🎮 Gamer
            </a>

          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-700 text-white">

        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">

          <div>

            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black">
              ✈️ ACHADOS DE VIAGEM
            </span>

            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Viajar melhor,
              <br />
              pagar menos
              <br />
              e aproveitar mais.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-sky-100">
              Ofertas, cupons, voos, hotéis, pacotes e experiências,
              combinados com nossos relatos, dicas, roteiros e vlogs.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <a
                href="#radar-real"
                className="rounded-xl bg-white px-6 py-4 font-black text-sky-950"
              >
                🔥 Ver Radar inteligente
              </a>

              <a
                href="#nossas-viagens"
                className="rounded-xl border border-white/30 bg-white/10 px-6 py-4 font-black"
              >
                🌎 Nossas viagens
              </a>

            </div>

          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur">

            <p className="text-sm font-black uppercase tracking-widest text-cyan-200">
              Nosso radar de oportunidades
            </p>

            <h2 className="mt-3 text-3xl font-black">
              O robô procura.
              <br />
              A gente ajuda você a decidir.
            </h2>

            <div className="mt-7 grid gap-3">

              <div className="rounded-2xl bg-white/10 p-4">
                <strong>📍 Porto Alegre</strong>
                <p className="mt-1 text-sm text-sky-100">
                  Nossa origem prioritária.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <strong>📍 São Paulo</strong>
                <p className="mt-1 text-sm text-sky-100">
                  Grande volume de rotas e oportunidades.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <strong>📍 Rio de Janeiro</strong>
                <p className="mt-1 text-sm text-sky-100">
                  Outra origem estratégica.
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* PRODUTO PRINCIPAL DA VERTICAL VIAGENS */}
      <RadarPublico />

      {/* PACOTES MANUAIS / AFILIADOS */}
      <PacotesPublicos />

      <section
        id="achados"
        className="mx-auto max-w-7xl px-5 py-16"
      >

        <span className="text-sm font-black uppercase tracking-widest text-sky-700">
          Economize viajando
        </span>

        <h2 className="mt-2 text-3xl font-black sm:text-4xl">
          Achados de Viagem
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Oportunidades encontradas automaticamente pelos nossos parceiros
          serão organizadas aqui por tipo de viagem.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {categorias.map((item) => (
            <article
              key={item.titulo}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >

              <div className="text-4xl">
                {item.icone}
              </div>

              <h3 className="mt-4 text-xl font-black">
                {item.titulo}
              </h3>

              <p className="mt-2 leading-6 text-slate-600">
                {item.texto}
              </p>

            </article>
          ))}

        </div>

        <div className="mt-8 rounded-3xl border border-dashed border-sky-300 bg-sky-50 p-8 text-center">

          <div className="text-4xl">
            🤖✈️
          </div>

          <h3 className="mt-3 text-xl font-black text-sky-950">
            Monitor automático de oportunidades
          </h3>

          <p className="mx-auto mt-2 max-w-2xl text-slate-600">
            Quando a Decolar ou futuros parceiros liberarem novas ofertas,
            cupons e campanhas, nosso sistema poderá trazê-las automaticamente.
          </p>

        </div>

      </section>

      <section
        id="nossas-viagens"
        className="border-y border-slate-200 bg-white"
      >

        <div className="mx-auto max-w-7xl px-5 py-16">

          <span className="text-sm font-black uppercase tracking-widest text-amber-600">
            Experiência real
          </span>

          <h2 className="mt-2 text-3xl font-black sm:text-4xl">
            Nossas Viagens
          </h2>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
            Este espaço vai reunir nossas experiências reais viajando em
            família: destinos, road trips, hospedagens, atrações,
            restaurantes, compras, transporte, acertos, erros e descobertas.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">

            <article className="rounded-3xl bg-slate-950 p-7 text-white">

              <div className="text-4xl">
                🌎
              </div>

              <h3 className="mt-4 text-2xl font-black">
                Relatos de viagem
              </h3>

              <p className="mt-3 leading-7 text-slate-300">
                Experiências reais, cidades, países e passeios que vivemos.
              </p>

              <span className="mt-6 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs font-bold">
                Em construção
              </span>

            </article>

            <article className="rounded-3xl bg-red-600 p-7 text-white">

              <div className="text-4xl">
                🎥
              </div>

              <h3 className="mt-4 text-2xl font-black">
                Vlogs
              </h3>

              <p className="mt-3 leading-7 text-red-50">
                Vídeos, passeios, road trips e bastidores das nossas viagens.
              </p>

              <span className="mt-6 inline-flex rounded-full bg-white/15 px-3 py-2 text-xs font-bold">
                Em construção
              </span>

            </article>

            <article className="rounded-3xl bg-amber-400 p-7 text-slate-950">

              <div className="text-4xl">
                🗺️
              </div>

              <h3 className="mt-4 text-2xl font-black">
                Guias e roteiros
              </h3>

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


<section className="mx-auto max-w-7xl px-5 py-16">

        <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-blue-800 p-8 text-white sm:p-10">

          <h2 className="text-3xl font-black">
            Viagens é uma vertical do Achados do Casal.
          </h2>

          <p className="mt-3 max-w-4xl leading-7 text-cyan-50">
            A Decolar será nossa primeira fonte comercial, mas esta área já
            nasce preparada para receber hotéis, companhias aéreas, seguros,
            ingressos, aluguel de carros, eSIM e novos parceiros.
          </p>

        </div>

      </section>

      <footer className="border-t border-slate-200 bg-white">

        <div className="mx-auto max-w-7xl px-5 py-8 text-sm text-slate-500">
          Achados do Casal • Viagens, economia e experiências reais.
        </div>

      </footer>

    </main>
  );
}