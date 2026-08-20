import Image from "next/image";

const PAISES = [
  ["ar", "Argentina"], ["br", "Brasil"], ["bs", "Bahamas"], ["ca", "Canadá"],
  ["ch", "Suíça"], ["co", "Colômbia"], ["hr", "Croácia"], ["hu", "Hungria"],
  ["it", "Itália"], ["jm", "Jamaica"], ["ky", "Ilhas Cayman"], ["mx", "México"],
  ["pe", "Peru"], ["py", "Paraguai"], ["si", "Eslovênia"], ["us", "Estados Unidos"],
  ["uy", "Uruguai"],
] as const;

const BRASIL_PRINCIPAIS = [
  ["15x", "Gramado", "RS"], ["4x", "Florianópolis", "SC"], ["3x", "Balneário Camboriú", "SC"],
  ["2x", "Rio de Janeiro", "RJ"], ["2x", "São Paulo", "SP"], ["2x", "Arraial d’Ajuda", "BA"],
  ["★", "Búzios", "RJ"], ["★", "Caraíva", "BA"], ["★", "Praia do Espelho", "BA"],
  ["★", "Porto de Galinhas", "PE"], ["★", "Foz do Iguaçu", "PR"], ["★", "Bonito", "MS"],
  ["★", "Manaus", "AM"], ["★", "Recife", "PE"], ["★", "João Pessoa", "PB"], ["★", "Brasília", "DF"],
] as const;

const OUTROS_BRASIL = ["Curitiba", "Bombinhas", "Canela", "Beto Carrero / Penha", "Blumenau", "Joinville", "Criciúma", "Caxias do Sul", "Dourados", "Guaíra", "Uruguaiana", "Cascavel", "Toledo", "Mucuri"] as const;

function MapaBrasil() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[360px]">
      <svg viewBox="0 0 320 390" role="img" aria-label="Mapa estilizado do Brasil com regiões visitadas" className="h-full w-full drop-shadow-[0_22px_40px_rgba(2,44,34,0.2)]">
        <defs>
          <linearGradient id="brasilV3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="55%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <path d="M118 15l38 13 34-8 22 24 34 8 15 27-12 26 25 27-11 28 19 24-16 30 2 30-24 22-5 35-24 16-11 37-27 19-16-18-6-35-22-18-4-33-27-10-17-28-29-8-5-28-22-21 4-31-15-22 16-29 5-32 27-13 18-27 29 2 20-19z" fill="url(#brasilV3)" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
        <path d="M74 90c42 25 110 25 159-7M67 180c50 24 127 27 179 3M108 265c37 13 77 13 111 3" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" strokeDasharray="7 8" />
        {[[88,73],[220,132],[188,214],[151,261],[171,326]].map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#fde047" stroke="#fff" strokeWidth="4" /><circle cx={x} cy={y} r="3" fill="#0f172a" /></g>)}
      </svg>
      <span className="absolute left-[4%] top-[12%] rounded-full bg-slate-950/90 px-3 py-2 text-xs font-black text-emerald-100">Amazônia</span>
      <span className="absolute right-[-2%] top-[31%] rounded-full bg-amber-300 px-3 py-2 text-xs font-black text-slate-950">Nordeste</span>
      <span className="absolute right-[0%] top-[53%] rounded-full bg-sky-700 px-3 py-2 text-xs font-black text-white">Sudeste</span>
      <span className="absolute left-[1%] top-[64%] rounded-full bg-emerald-800 px-3 py-2 text-xs font-black text-white">Centro-Oeste</span>
      <span className="absolute left-[19%] bottom-[6%] rounded-full bg-teal-700 px-3 py-2 text-xs font-black text-white">Sul</span>
    </div>
  );
}

export default function ExperienciaViagensV3() {
  return (
    <section id="nossas-viagens" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <span className="text-sm font-black uppercase tracking-[0.2em] text-amber-600">Nossa história viajando</span>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Tudo começou com uma demissão.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Quando minha esposa foi demitida, recebeu a rescisão e teve uma ideia simples: <strong className="text-slate-950">“Por que não viajar?”</strong> Eu aceitei. A primeira viagem virou hábito e, depois, parte da nossa vida.</p>
            <p className="mt-4 text-lg leading-8 text-slate-600">Hoje a experiência mudou de fase: viajamos em família, continuamos montando nossos próprios roteiros e transformamos o que aprendemos na prática em conteúdo para ajudar outras pessoas a viajar melhor.</p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-sky-950 p-4 text-white"><p className="text-3xl font-black text-cyan-300">17</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-sky-100">países e territórios</p></div>
              <div className="rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-3xl font-black">14x</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-100">Orlando</p></div>
              <div className="rounded-2xl bg-amber-300 p-4 text-slate-950"><p className="text-3xl font-black">4</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-amber-900">regiões do mundo</p></div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-2xl">
            <div className="relative min-h-[430px] sm:min-h-[520px]">
              <Image src="/viagens/familia-seaworld.svg" alt="Família completa em viagem ao SeaWorld Orlando" fill unoptimized priority className="object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <span className="inline-flex rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-slate-950">A família completa</span>
                <h3 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">O hobby do casal virou história de família.</h3>
                <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">Orlando continua fazendo parte da nossa história — agora com uma nova geração vivendo tudo junto.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
            <div className="relative aspect-[16/10]"><Image src="/viagens/familia-times-square.jpg" alt="Família em Nova York" fill unoptimized className="object-cover object-[center_38%]" /></div>
            <div className="p-5 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Nova York · viagem em família</p><p className="mt-2 text-xl font-black">Viajar mudou de fase — e ficou ainda mais importante para nós.</p></div>
          </article>
          <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-[16/10]"><Image src="/viagens/casal-europa.jpg" alt="Casal viajando pela Europa" fill unoptimized className="object-cover object-[center_42%]" /></div>
            <div className="p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Europa</p><p className="mt-2 text-xl font-black text-slate-950">Antes dos filhos, descobrindo cidades, culturas e nosso próprio jeito de viajar.</p></div>
          </article>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2.4rem] border border-emerald-300 bg-[radial-gradient(circle_at_10%_15%,rgba(16,185,129,.25),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(14,165,233,.20),transparent_28%),linear-gradient(135deg,#ecfdf5_0%,#f0fdfa_47%,#eff6ff_100%)] shadow-xl shadow-emerald-900/5">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-emerald-300 bg-white/75 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-800">🇧🇷 Explorando o Brasil</span>
              <h3 className="mt-4 text-4xl font-black leading-tight text-slate-950">Nosso país também é parte grande da história.</h3>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">Do Sul à Amazônia, passando pelo litoral catarinense, Região dos Lagos, Bahia e Nordeste. Aqui a ideia é mostrar território, recorrência e memória — não uma lista fria de cidades.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-[1.05fr_0.95fr] sm:items-center">
                <div className="rounded-[2rem] border border-white/90 bg-white/65 p-5 backdrop-blur"><MapaBrasil /></div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-3xl font-black">15x</p><p className="font-black">Gramado</p><p className="mt-1 text-xs text-emerald-100">Morando perto, virou quase extensão de casa.</p></div>
                  <div className="rounded-2xl bg-sky-700 p-4 text-white"><p className="text-3xl font-black">2x</p><p className="font-black">Arraial d’Ajuda</p><p className="mt-1 text-xs text-sky-100">Uma Bahia que fez a gente querer voltar.</p></div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Um lugar que marcou</p><p className="mt-1 font-black text-slate-950">Caraíva</p><p className="mt-1 text-xs font-semibold text-slate-600">Entrou fácil na lista das praias mais especiais que já conhecemos.</p></div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/90 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Principais destinos</p><h4 className="mt-1 text-2xl font-black text-slate-950">Brasil vivido de verdade</h4></div><span className="text-3xl">✈️</span></div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BRASIL_PRINCIPAIS.map(([vezes, cidade, uf]) => <div key={cidade} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-lg font-black text-emerald-700">{vezes}</span><span className="text-[10px] font-black text-slate-400">{uf}</span></div><p className="mt-1 text-sm font-black leading-tight text-slate-950">{cidade}</p></div>)}
              </div>
              <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Costa do Descobrimento</p><p className="mt-2 font-black text-slate-950">Arraial d’Ajuda · Caraíva · Praia do Espelho · Porto Seguro</p></div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">E ainda passamos por</p><div className="mt-3 flex flex-wrap gap-2">{OUTROS_BRASIL.map((destino) => <span key={destino} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{destino}</span>)}</div></div>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-900/10">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
            <div className="flex flex-col justify-center"><span className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Nosso mapa pelo mundo</span><h3 className="mt-3 text-4xl font-black leading-tight">17 países e territórios já fazem parte da nossa história.</h3><p className="mt-4 leading-7 text-slate-300">Cada bandeira representa uma experiência real: destinos que entraram nos nossos roteiros, decisões, acertos, erros e memórias.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">América do Sul</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">América do Norte</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">Caribe</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">Europa</span></div></div>
            <div>
              <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 sm:min-h-[340px]"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Blank_world_map.svg" alt="Mapa-múndi mostrando as regiões já visitadas" className="absolute inset-0 h-full w-full object-contain p-4 opacity-20 invert" /><div className="absolute left-[14%] top-[28%] rounded-full bg-slate-950/85 px-3 py-2 text-xs font-black text-cyan-200">● América do Norte</div><div className="absolute left-[24%] top-[61%] rounded-full bg-slate-950/85 px-3 py-2 text-xs font-black text-emerald-200">● América do Sul</div><div className="absolute left-[50%] top-[27%] rounded-full bg-slate-950/85 px-3 py-2 text-xs font-black text-amber-200">● Europa</div><div className="absolute left-[22%] top-[44%] hidden rounded-full bg-slate-950/85 px-3 py-2 text-xs font-black text-pink-200 sm:block">● Caribe</div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{PAISES.map(([codigo, pais]) => <div key={pais} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><img src={`https://flagcdn.com/w80/${codigo}.png`} alt={`Bandeira de ${pais}`} className="h-5 w-8 shrink-0 rounded-sm object-cover shadow-sm" loading="lazy" /><span className="text-sm font-black text-slate-100">{pais}</span></div>)}</div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3"><article className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Relatos</p><h3 className="mt-3 text-2xl font-black">Experiências reais</h3><p className="mt-3 leading-7 text-slate-300">O que valeu a pena, o que faríamos diferente e decisões que realmente funcionaram para nós.</p></article><article className="rounded-3xl bg-red-600 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-100">Vlogs</p><h3 className="mt-3 text-2xl font-black">Viagem por dentro</h3><p className="mt-3 leading-7 text-red-50">Bastidores, road trips, atrações e experiências que ajudam outras famílias a planejar melhor.</p></article><article className="rounded-3xl bg-amber-300 p-6 text-slate-950"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Guias</p><h3 className="mt-3 text-2xl font-black">Roteiros práticos</h3><p className="mt-3 leading-7 text-slate-800">Hospedagem, transporte, atrações, duração ideal e dicas aprendidas em viagens de verdade.</p></article></div>
      </div>
    </section>
  );
}
