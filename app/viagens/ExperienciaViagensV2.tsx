import Image from "next/image";

const PAISES = [
  ["ar", "Argentina"], ["br", "Brasil"], ["bs", "Bahamas"], ["ca", "Canadá"],
  ["ch", "Suíça"], ["co", "Colômbia"], ["hr", "Croácia"], ["hu", "Hungria"],
  ["it", "Itália"], ["jm", "Jamaica"], ["ky", "Ilhas Cayman"], ["mx", "México"],
  ["pe", "Peru"], ["py", "Paraguai"], ["si", "Eslovênia"], ["us", "Estados Unidos"],
  ["uy", "Uruguai"],
] as const;

const ESTATISTICAS = [
  ["14x", "Orlando"], ["3x", "Miami"], ["2x", "Nova York"],
  ["17", "países e territórios"], ["4", "regiões do mundo"], ["1", "hobby que virou paixão"],
] as const;

const BRASIL_DESTAQUES = [
  ["15x", "Gramado", "Rio Grande do Sul", "Serra Gaúcha"],
  ["4x", "Florianópolis", "Santa Catarina", "Ilha + Canasvieiras"],
  ["3x", "Balneário Camboriú", "Santa Catarina", "Litoral"],
  ["2x", "Rio de Janeiro", "Rio de Janeiro", "Cidade + praias"],
  ["2x", "São Paulo", "São Paulo", "Capital"],
  ["2x", "Arraial d’Ajuda", "Bahia", "Costa do Descobrimento"],
  ["★", "Búzios", "Rio de Janeiro", "Região dos Lagos + praias"],
  ["★", "Caraíva", "Bahia", "Uma praia que marcou"],
  ["★", "Praia do Espelho", "Bahia", "Litoral sul"],
  ["★", "Porto de Galinhas", "Pernambuco", "Piscinas naturais"],
  ["★", "Foz do Iguaçu", "Paraná", "Cataratas"],
  ["★", "Bonito", "Mato Grosso do Sul", "Natureza"],
  ["★", "Manaus", "Amazonas", "Amazônia"],
  ["★", "Recife", "Pernambuco", "Nordeste"],
  ["★", "João Pessoa", "Paraíba", "Nordeste"],
  ["★", "Brasília", "Distrito Federal", "Capital do Brasil"],
] as const;

const OUTROS_BRASIL = [
  "Curitiba", "Bombinhas", "Canela", "Beto Carrero / Penha", "Blumenau", "Joinville",
  "Criciúma", "Caxias do Sul", "Dourados", "Guaíra", "Uruguaiana", "Cascavel", "Toledo", "Mucuri",
] as const;

function Foto({ src, label, title, position = "center" }: { src: string; label: string; title: string; position?: string }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Image src={src} alt={title} fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" style={{ objectPosition: position }} />
      </div>
      <div className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">{label}</p>
        <p className="mt-2 text-lg font-black text-slate-950">{title}</p>
      </div>
    </article>
  );
}

function MapaBrasil() {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[330px]">
      <svg viewBox="0 0 320 390" role="img" aria-label="Mapa estilizado do Brasil com regiões já visitadas" className="h-full w-full drop-shadow-[0_18px_35px_rgba(2,44,34,0.18)]">
        <defs>
          <linearGradient id="brasilFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="45%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <path d="M118 15l38 13 34-8 22 24 34 8 15 27-12 26 25 27-11 28 19 24-16 30 2 30-24 22-5 35-24 16-11 37-27 19-16-18-6-35-22-18-4-33-27-10-17-28-29-8-5-28-22-21 4-31-15-22 16-29 5-32 27-13 18-27 29 2 20-19z" fill="url(#brasilFill)" stroke="rgba(255,255,255,.9)" strokeWidth="5" strokeLinejoin="round" />
        <path d="M74 90c42 25 110 25 159-7M67 180c50 24 127 27 179 3M108 265c37 13 77 13 111 3" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" strokeDasharray="7 8" />
        {[
          [88, 73, "Amazônia"], [220, 132, "Nordeste"], [188, 214, "Sudeste"], [151, 261, "Centro-Oeste"], [171, 326, "Sul"],
        ].map(([x, y, label]) => <g key={String(label)}><circle cx={Number(x)} cy={Number(y)} r="9" fill="#fde047" stroke="#fff" strokeWidth="4" /><circle cx={Number(x)} cy={Number(y)} r="3" fill="#0f172a" /></g>)}
      </svg>
      <span className="absolute left-[5%] top-[13%] rounded-full bg-slate-950/85 px-3 py-2 text-xs font-black text-emerald-100">Amazônia</span>
      <span className="absolute right-[-2%] top-[31%] rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-slate-950">Nordeste</span>
      <span className="absolute right-[1%] top-[52%] rounded-full bg-sky-700 px-3 py-2 text-xs font-black text-white">Sudeste</span>
      <span className="absolute left-[1%] top-[63%] rounded-full bg-emerald-800 px-3 py-2 text-xs font-black text-white">Centro-Oeste</span>
      <span className="absolute left-[19%] bottom-[7%] rounded-full bg-teal-700 px-3 py-2 text-xs font-black text-white">Sul</span>
    </div>
  );
}

export default function ExperienciaViagensV2() {
  return (
    <section id="nossas-viagens" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <span className="text-sm font-black uppercase tracking-[0.2em] text-amber-600">Nossa história viajando</span>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Tudo começou com uma demissão.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Quando minha esposa foi demitida, recebeu a rescisão e teve uma ideia simples: <strong className="text-slate-950">“Por que não viajar?”</strong> Ela me convidou, eu aceitei e aquela decisão inesperada mudou a nossa vida.</p>
            <p className="mt-4 text-lg leading-8 text-slate-600">A primeira viagem virou hábito. Hoje pesquisar rotas, comparar preços, montar roteiros, descobrir cidades e entender o que realmente vale a pena faz parte da nossa rotina.</p>
            <div className="mt-7 rounded-3xl bg-gradient-to-br from-sky-950 to-blue-800 p-6 text-white shadow-xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">O que veio depois</p>
              <p className="mt-3 text-2xl font-black leading-tight sm:text-3xl">Viajar deixou de ser exceção e virou parte da nossa vida — como casal e, depois, como família.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-sky-200 bg-sky-50 p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Estados Unidos</p><p className="mt-2 text-3xl font-black">14x Orlando</p><p className="mt-3 leading-7 text-slate-600">Miami 3x, Nova York 2x e viagens marcantes por Los Angeles, Las Vegas, Chicago, Boston, Washington DC, Filadélfia, Cleveland, Atlanta, Tampa, Panama City Beach, Daytona Beach, Kennedy Space Center/NASA, Indianapolis e outras cidades.</p></article>
            <article className="rounded-3xl border border-red-200 bg-red-50 p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Canadá</p><p className="mt-2 text-3xl font-black">Toronto · Montreal · Ottawa</p><p className="mt-3 leading-7 text-slate-600">Cidades bem diferentes entre si, que ensinaram bastante sobre deslocamentos, clima, ritmo e planejamento.</p></article>
            <article className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Cruzeiros</p><p className="mt-2 text-3xl font-black">Lua de mel a bordo</p><p className="mt-3 leading-7 text-slate-600">A lua de mel apresentou um modelo de viagem que até então era desconhecido para nós — e que virou mais uma forma de viajar que passamos a entender na prática.</p></article>
            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Europa e além</p><p className="mt-2 text-3xl font-black">Estradas, cidades e família</p><p className="mt-3 leading-7 text-slate-600">Vieram cidades históricas, novas culturas, road trips e viagens em família. A experiência continua crescendo a cada roteiro.</p></article>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Foto src="/viagens/familia-times-square.jpg" label="Nova York · viagem em família" title="Viajar mudou de fase com a família — e ficou ainda mais importante para nós." position="center 38%" />
          <Foto src="/viagens/casal-europa.jpg" label="Europa" title="De casal, descobrindo cidades, culturas e um jeito próprio de viajar." position="center 42%" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ESTATISTICAS.map(([numero, legenda]) => <div key={legenda} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className="text-2xl font-black text-sky-800">{numero}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{legenda}</p></div>)}
        </div>

        <div className="mt-10 overflow-hidden rounded-[2.25rem] border border-emerald-300 bg-[radial-gradient(circle_at_12%_18%,rgba(16,185,129,.28),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,.22),transparent_30%),linear-gradient(135deg,#ecfdf5_0%,#f0fdfa_44%,#eff6ff_100%)] shadow-xl shadow-emerald-900/5">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
            <div>
              <span className="inline-flex rounded-full border border-emerald-300 bg-white/70 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-800">🇧🇷 Explorando o Brasil</span>
              <h3 className="mt-4 text-4xl font-black leading-tight text-slate-950">Nosso país também faz parte da nossa história.</h3>
              <p className="mt-4 leading-7 text-slate-600">Do Sul à Amazônia, passando pelo litoral catarinense, Região dos Lagos, Bahia e Nordeste, a gente gosta de capitais, cidades menores, estrada, natureza e praia — e vários desses lugares já receberam a gente mais de uma vez.</p>
              <div className="mt-6 rounded-3xl border border-white/80 bg-white/65 p-5 backdrop-blur"><MapaBrasil /></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-700 p-4 text-white"><p className="text-3xl font-black">15x</p><p className="mt-1 text-sm font-black">Gramado</p><p className="mt-1 text-xs text-emerald-100">Morando perto, virou quase extensão de casa.</p></div>
                <div className="rounded-2xl bg-sky-700 p-4 text-white"><p className="text-3xl font-black">2x</p><p className="mt-1 text-sm font-black">Arraial d’Ajuda</p><p className="mt-1 text-xs text-sky-100">Bahia que fez a gente querer voltar.</p></div>
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Costa do Descobrimento</p><p className="mt-2 font-black text-slate-950">Arraial d’Ajuda · Caraíva · Praia do Espelho · Porto Seguro</p><p className="mt-2 text-sm leading-6 text-slate-600">Uma das regiões que mais renderam experiências marcantes — com Caraíva entrando fácil na lista de praias mais especiais que já conhecemos.</p></div>
              <div className="mt-3 rounded-2xl border border-sky-200 bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Região dos Lagos</p><p className="mt-2 font-black text-slate-950">Búzios e praias da região</p><p className="mt-2 text-sm leading-6 text-slate-600">Outro pedaço do litoral brasileiro que entrou na nossa lista de grandes viagens pelo país.</p></div>
            </div>

            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Destinos que já entraram nos nossos roteiros</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BRASIL_DESTAQUES.map(([vezes, cidade, estado, perfil]) => <div key={cidade} className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-2"><span className="text-2xl font-black text-emerald-700">{vezes}</span><span className="text-xl" aria-hidden>🇧🇷</span></div><p className="mt-2 font-black text-slate-950">{cidade}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{estado}</p><p className="mt-2 text-xs font-semibold text-slate-500">{perfil}</p></div>)}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/85 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">E ainda passamos por</p><div className="mt-3 flex flex-wrap gap-2">{OUTROS_BRASIL.map((destino) => <span key={destino} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{destino}</span>)}</div></div>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-900/10">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
            <div className="flex flex-col justify-center"><span className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Nosso mapa pelo mundo</span><h3 className="mt-3 text-4xl font-black leading-tight">17 países e territórios já fazem parte da nossa história.</h3><p className="mt-4 leading-7 text-slate-300">Cada bandeira representa uma experiência real: destinos que já entraram nos nossos roteiros, decisões, acertos, erros e memórias.</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">América do Sul</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">América do Norte</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">Caribe</span><span className="rounded-full bg-cyan-300/10 px-3 py-2 text-cyan-200">Europa</span></div></div>
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
