const PAISES = [
  ["🇦🇷", "Argentina"], ["🇧🇷", "Brasil"], ["🇧🇸", "Bahamas"], ["🇨🇦", "Canadá"],
  ["🇨🇭", "Suíça"], ["🇨🇴", "Colômbia"], ["🇭🇷", "Croácia"], ["🇭🇺", "Hungria"],
  ["🇮🇹", "Itália"], ["🇯🇲", "Jamaica"], ["🇰🇾", "Ilhas Cayman"], ["🇲🇽", "México"],
  ["🇵🇪", "Peru"], ["🇵🇾", "Paraguai"], ["🇸🇮", "Eslovênia"], ["🇺🇸", "Estados Unidos"],
  ["🇺🇾", "Uruguai"],
] as const;

const BRASIL_PRINCIPAIS = [
  ["15x", "Gramado", "RS", "Serra Gaúcha"],
  ["4x", "Florianópolis", "SC", "Ilha + Canasvieiras"],
  ["3x", "Balneário Camboriú", "SC", "Litoral"],
  ["2x", "Rio de Janeiro", "RJ", "Cidade + praias"],
  ["2x", "São Paulo", "SP", "Capital"],
  ["2x", "Arraial d’Ajuda", "BA", "Costa do Descobrimento"],
  ["★", "Búzios", "RJ", "Região dos Lagos"],
  ["★", "Caraíva", "BA", "Praia que marcou"],
  ["★", "Praia do Espelho", "BA", "Litoral sul"],
  ["★", "Porto de Galinhas", "PE", "Piscinas naturais"],
  ["★", "Foz do Iguaçu", "PR", "Cataratas"],
  ["★", "Bonito", "MS", "Natureza"],
  ["★", "Manaus", "AM", "Amazônia"],
  ["★", "Recife", "PE", "Nordeste"],
  ["★", "João Pessoa", "PB", "Nordeste"],
  ["★", "Brasília", "DF", "Capital do Brasil"],
] as const;

const OUTROS_BRASIL = [
  "Curitiba", "Bombinhas", "Canela", "Beto Carrero / Penha", "Blumenau", "Joinville",
  "Criciúma", "Caxias do Sul", "Dourados", "Guaíra", "Uruguaiana", "Cascavel", "Toledo", "Mucuri",
] as const;

function MapaBrasil() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[360px]">
      <svg viewBox="0 0 320 390" role="img" aria-label="Mapa estilizado do Brasil com regiões visitadas" className="h-full w-full drop-shadow-[0_22px_40px_rgba(2,44,34,0.2)]">
        <defs>
          <linearGradient id="brasilEditorial" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="52%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <path d="M118 15l38 13 34-8 22 24 34 8 15 27-12 26 25 27-11 28 19 24-16 30 2 30-24 22-5 35-24 16-11 37-27 19-16-18-6-35-22-18-4-33-27-10-17-28-29-8-5-28-22-21 4-31-15-22 16-29 5-32 27-13 18-27 29 2 20-19z" fill="url(#brasilEditorial)" stroke="#ffffff" strokeWidth="5" strokeLinejoin="round" />
        <path d="M74 90c42 25 110 25 159-7M67 180c50 24 127 27 179 3M108 265c37 13 77 13 111 3" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" strokeDasharray="7 8" />
        {[[88,73],[220,132],[188,214],[151,261],[171,326]].map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#fde047" stroke="#fff" strokeWidth="4" /><circle cx={x} cy={y} r="3" fill="#0f172a" /></g>)}
      </svg>
      <span className="absolute left-[3%] top-[12%] rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-emerald-100">Amazônia</span>
      <span className="absolute right-[-1%] top-[31%] rounded-full bg-amber-300 px-3 py-2 text-xs font-black text-slate-950">Nordeste</span>
      <span className="absolute right-[0%] top-[53%] rounded-full bg-sky-700 px-3 py-2 text-xs font-black text-white">Sudeste</span>
      <span className="absolute left-[1%] top-[64%] rounded-full bg-emerald-800 px-3 py-2 text-xs font-black text-white">Centro-Oeste</span>
      <span className="absolute left-[19%] bottom-[6%] rounded-full bg-teal-700 px-3 py-2 text-xs font-black text-white">Sul</span>
    </div>
  );
}

function MapaMundo() {
  return (
    <div className="relative min-h-[290px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 sm:min-h-[350px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(34,211,238,.08),transparent_24%),radial-gradient(circle_at_66%_32%,rgba(250,204,21,.08),transparent_26%)]" />
      <svg viewBox="0 0 800 390" className="absolute inset-0 h-full w-full p-5 opacity-35" aria-hidden>
        <g fill="#64748b">
          <path d="M73 86l60-32 84 8 55 45-20 38-50 16-13 35-58-12-34-42-48-18z" />
          <path d="M216 195l55 19 22 43-18 52-26 56-26-19 8-58-31-41z" />
          <path d="M355 96l46-20 57 12 16 24-38 16-31-8-25 17-36-17z" />
          <path d="M400 149l48 7 37 39-11 55-32 68-31-26-13-61-27-39z" />
          <path d="M465 83l91-34 111 22 72 55-39 31-70-13-34 28-52-10-27-31-54-7z" />
          <path d="M650 273l52-6 37 27-11 37-49 7-35-28z" />
          <path d="M694 166l26-5 15 18-17 14-26-8z" />
        </g>
        <g fill="none" stroke="rgba(148,163,184,.25)" strokeWidth="1.5">
          <path d="M20 195h760" /><path d="M400 20v350" />
        </g>
      </svg>
      <span className="absolute left-[12%] top-[25%] rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-cyan-200">● América do Norte</span>
      <span className="absolute left-[26%] top-[61%] rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-emerald-200">● América do Sul</span>
      <span className="absolute left-[50%] top-[27%] rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-amber-200">● Europa</span>
      <span className="absolute left-[22%] top-[45%] hidden rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-pink-200 sm:block">● Caribe</span>
    </div>
  );
}

export default function ExperienciaViagensV3() {
  return (
    <section id="nossas-viagens" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="overflow-hidden rounded-[2.35rem] border border-slate-200 bg-[linear-gradient(120deg,#ffffff_0%,#f8fafc_58%,#ecfeff_100%)] shadow-sm">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-12">
            <div>
              <span className="text-sm font-black uppercase tracking-[0.22em] text-amber-600">Nossa história viajando</span>
              <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl">Tudo começou com uma demissão.</h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Quando minha esposa foi demitida, recebeu a rescisão e teve uma ideia simples: <strong className="text-slate-950">“Por que não viajar?”</strong> Eu aceitei. A primeira viagem virou hábito e, depois, parte da nossa vida.</p>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Hoje viajamos em família, continuamos montando nossos próprios roteiros e transformamos o que aprendemos na prática em conteúdo para ajudar outras pessoas a viajar melhor.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <div className="rounded-3xl bg-sky-950 p-5 text-white"><p className="text-4xl font-black text-cyan-300">17</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-sky-100">países e territórios</p></div>
              <div className="rounded-3xl bg-emerald-700 p-5 text-white"><p className="text-4xl font-black">14x</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-100">Orlando</p></div>
              <div className="rounded-3xl bg-amber-300 p-5 text-slate-950"><p className="text-4xl font-black">4</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-amber-900">regiões do mundo</p></div>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2.5rem] border border-emerald-300 bg-[radial-gradient(circle_at_10%_12%,rgba(16,185,129,.24),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(14,165,233,.22),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f0fdfa_46%,#eff6ff_100%)] shadow-xl shadow-emerald-900/5">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.86fr_1.14fr] lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-emerald-300 bg-white/75 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-800">🇧🇷 Explorando o Brasil</span>
              <h3 className="mt-4 max-w-xl text-4xl font-black leading-tight text-slate-950">Nosso país também é parte grande da história.</h3>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">Do Sul à Amazônia, passando pelo litoral catarinense, Região dos Lagos, Bahia e Nordeste. Aqui a ideia é mostrar território, recorrência e memória — não uma lista fria de cidades.</p>

              <div className="mt-6 rounded-[2rem] border border-white/90 bg-white/65 p-5 backdrop-blur"><MapaBrasil /></div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-3xl font-black">15x</p><p className="font-black">Gramado</p></div>
                <div className="rounded-2xl bg-sky-700 p-4 text-white"><p className="text-3xl font-black">4x</p><p className="font-black">Florianópolis</p></div>
                <div className="rounded-2xl bg-amber-300 p-4 text-slate-950"><p className="text-3xl font-black">3x</p><p className="font-black">Balneário</p></div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/90 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Principais destinos</p><h4 className="mt-1 text-2xl font-black text-slate-950">Brasil vivido de verdade</h4></div>
                <span className="text-3xl" aria-hidden>✈️</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BRASIL_PRINCIPAIS.map(([vezes, cidade, uf, perfil]) => (
                  <div key={cidade} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2"><span className="text-lg font-black text-emerald-700">{vezes}</span><span className="text-[10px] font-black text-slate-400">{uf}</span></div>
                    <p className="mt-1 text-sm font-black leading-tight text-slate-950">{cidade}</p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{perfil}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/75 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Costa do Descobrimento</p><p className="mt-2 text-sm font-black leading-6 text-slate-950">Arraial d’Ajuda · Caraíva · Praia do Espelho · Porto Seguro</p></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Um lugar que marcou</p><p className="mt-2 text-lg font-black text-slate-950">Caraíva</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Entrou fácil na lista das praias mais especiais que já conhecemos.</p></div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">E ainda passamos por</p><div className="mt-3 flex flex-wrap gap-2">{OUTROS_BRASIL.map((destino) => <span key={destino} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{destino}</span>)}</div></div>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2.35rem] border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-900/10">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Nosso mapa pelo mundo</span>
              <h3 className="mt-3 text-4xl font-black leading-tight">17 países e territórios já fazem parte da nossa história.</h3>
              <p className="mt-4 leading-7 text-slate-300">Cada bandeira representa uma experiência real: destinos que entraram nos nossos roteiros, decisões, acertos, erros e memórias.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black text-cyan-300">17</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">países e territórios</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black text-emerald-300">4</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">regiões</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-2xl font-black text-amber-300">100+</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">memórias</p></div>
              </div>
            </div>
            <div>
              <MapaMundo />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {PAISES.map(([bandeira, pais]) => <div key={pais} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><span className="text-xl" aria-hidden>{bandeira}</span><span className="text-sm font-black text-slate-100">{pais}</span></div>)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Relatos</p><h3 className="mt-3 text-2xl font-black">Experiências reais</h3><p className="mt-3 leading-7 text-slate-300">O que valeu a pena, o que faríamos diferente e decisões que realmente funcionaram para nós.</p></article>
          <article className="rounded-3xl bg-red-600 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-100">Vlogs</p><h3 className="mt-3 text-2xl font-black">Viagem por dentro</h3><p className="mt-3 leading-7 text-red-50">Bastidores, road trips, atrações e experiências que ajudam outras famílias a planejar melhor.</p></article>
          <article className="rounded-3xl bg-amber-300 p-6 text-slate-950"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Guias</p><h3 className="mt-3 text-2xl font-black">Roteiros práticos</h3><p className="mt-3 leading-7 text-slate-800">Hospedagem, transporte, atrações, duração ideal e dicas aprendidas em viagens de verdade.</p></article>
        </div>
      </div>
    </section>
  );
}
