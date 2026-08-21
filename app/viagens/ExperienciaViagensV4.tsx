const PAISES = [
  ["ar", "Argentina"], ["br", "Brasil"], ["bs", "Bahamas"], ["ca", "Canadá"],
  ["ch", "Suíça"], ["co", "Colômbia"], ["hr", "Croácia"], ["hu", "Hungria"],
  ["it", "Itália"], ["jm", "Jamaica"], ["ky", "Ilhas Cayman"], ["mx", "México"],
  ["pe", "Peru"], ["py", "Paraguai"], ["si", "Eslovênia"], ["us", "Estados Unidos"],
  ["uy", "Uruguai"],
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

function MapaBrasilReal() {
  return (
    <div className="relative mx-auto aspect-[1/1] w-full max-w-[430px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-5 shadow-inner backdrop-blur">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,.17),transparent_40%),linear-gradient(145deg,rgba(236,253,245,.7),rgba(224,242,254,.7))]" />
      <img
        src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Brazil_Blank_Map.svg"
        alt="Mapa real do Brasil com divisão dos estados"
        className="absolute inset-[7%] h-[86%] w-[86%] object-contain opacity-95"
        style={{ filter: "sepia(.1) saturate(.8) hue-rotate(115deg) brightness(.9)" }}
      />
      <span className="absolute left-[10%] top-[18%] rounded-full bg-emerald-800 px-3 py-2 text-xs font-black text-white shadow-lg">📍 Amazônia</span>
      <span className="absolute right-[5%] top-[31%] rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 shadow-lg">📍 Nordeste</span>
      <span className="absolute right-[6%] top-[59%] rounded-full bg-violet-700 px-3 py-2 text-xs font-black text-white shadow-lg">📍 Sudeste</span>
      <span className="absolute left-[4%] top-[52%] rounded-full bg-amber-500 px-3 py-2 text-xs font-black text-white shadow-lg">📍 Centro-Oeste</span>
      <span className="absolute left-[33%] bottom-[7%] rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-lg">📍 Sul</span>
    </div>
  );
}

function MapaMundoReal() {
  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#07172c] sm:min-h-[370px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(14,165,233,.15),transparent_28%),radial-gradient(circle_at_58%_30%,rgba(250,204,21,.08),transparent_25%)]" />
      <img
        src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Blank_world_map_Robinson_projection.svg"
        alt="Mapa-múndi real em projeção Robinson"
        className="absolute inset-[5%] h-[90%] w-[90%] object-contain opacity-55 invert"
      />
      <span className="absolute left-[9%] top-[28%] rounded-full bg-sky-700 px-3 py-2 text-xs font-black text-white shadow-lg">🌎 América do Norte</span>
      <span className="absolute left-[25%] top-[67%] rounded-full bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-lg">📍 América do Sul</span>
      <span className="absolute left-[52%] top-[24%] rounded-full bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 shadow-lg">Europa</span>
      <span className="absolute left-[25%] top-[48%] hidden rounded-full bg-pink-400 px-3 py-2 text-xs font-black text-slate-950 shadow-lg sm:block">Caribe</span>
    </div>
  );
}

export default function ExperienciaViagensV4() {
  return (
    <section id="nossas-viagens" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-5 sm:py-16">
        <div className="mb-8 rounded-[2.2rem] border border-slate-200 bg-white p-7 shadow-sm lg:p-10">
          <span className="text-xs font-black uppercase tracking-[0.24em] text-amber-600">Nossa história viajando</span>
          <h2 className="mt-3 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">Tudo começou com uma demissão.</h2>
          <p className="mt-4 max-w-5xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Quando minha esposa foi demitida, recebeu a rescisão e teve uma ideia simples: <strong className="text-slate-950">“Por que não viajar?”</strong> Eu aceitei. A primeira viagem virou hábito e, depois, parte da nossa vida. Hoje viajamos em família, montamos nossos próprios roteiros e transformamos o que aprendemos na prática em conteúdo.</p>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] border border-emerald-300 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,.23),transparent_26%),radial-gradient(circle_at_62%_8%,rgba(34,211,238,.17),transparent_24%),linear-gradient(135deg,#ecfdf5_0%,#ecfeff_50%,#f0f9ff_100%)] shadow-xl shadow-emerald-900/5">
          <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[0.95fr_1.25fr] lg:p-8">
            <div>
              <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-800">🇧🇷 Explorando o Brasil</span>
              <h3 className="mt-4 max-w-xl text-4xl font-black leading-[1.06] text-slate-950">Nosso país também é parte da nossa história.</h3>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">Das montanhas do Sul às praias do Nordeste, da Amazônia ao Centro-Oeste, o Brasil sempre nos surpreende. Paisagens, estrada, cidades, natureza e lugares que fizeram a gente voltar.</p>
              <div className="mt-6"><MapaBrasilReal /></div>
            </div>

            <div className="rounded-[2rem] border border-white/90 bg-white/85 p-4 shadow-sm backdrop-blur sm:p-5">
              <h4 className="text-2xl font-black text-slate-950">Principais destinos</h4>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {BRASIL_PRINCIPAIS.map(([vezes, cidade, uf, perfil]) => (
                  <div key={cidade} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2"><span className="text-lg font-black text-emerald-700">{vezes}</span><span className="text-[10px] font-black text-slate-400">{uf}</span></div>
                    <p className="mt-1 text-sm font-black leading-tight text-slate-950">{cidade}</p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{perfil}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-xs text-slate-600"><span className="font-black text-emerald-800">📍 Outros lugares: </span>{OUTROS_BRASIL.join(" · ")}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[2.5rem] border border-slate-800 bg-[#061426] text-white shadow-2xl shadow-slate-900/10">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="flex flex-col justify-center border-b border-white/10 p-7 sm:p-9 lg:border-b-0 lg:border-r">
              <span className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Nosso mapa pelo mundo</span>
              <h3 className="mt-3 text-4xl font-black leading-tight">17 países e territórios, centenas de histórias.</h3>
              <p className="mt-4 max-w-xl leading-7 text-slate-300">Cada ponto no mapa é uma experiência real: culturas diferentes, paisagens inesquecíveis, decisões, acertos, erros e aprendizados que levamos para a vida.</p>
            </div>
            <div className="grid gap-4 p-5 sm:p-7 xl:grid-cols-[1fr_0.5fr]">
              <MapaMundoReal />
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                <h4 className="text-lg font-black">Países e territórios</h4>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 xl:grid-cols-1">
                  {PAISES.map(([codigo, pais]) => (
                    <div key={pais} className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <img src={`https://flagcdn.com/w40/${codigo}.png`} alt={`Bandeira de ${pais}`} className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" loading="lazy" />
                      <span>{pais}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-sky-600 p-4"><p className="font-black">📍 E a lista continua...</p><p className="mt-1 text-xs text-sky-100">Sempre com novos planos, destinos e sonhos.</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Relatos</p><h3 className="mt-3 text-2xl font-black">Experiências reais</h3><p className="mt-3 leading-7 text-slate-300">O que valeu a pena, o que faríamos diferente e decisões que realmente funcionaram para nós.</p></article>
          <article className="rounded-3xl bg-red-600 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-red-100">Vlogs</p><h3 className="mt-3 text-2xl font-black">Viagem por dentro</h3><p className="mt-3 leading-7 text-red-50">Bastidores, road trips, atrações e experiências que ajudam outras famílias a planejar melhor.</p></article>
          <article className="rounded-3xl bg-amber-300 p-6 text-slate-950"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Guias</p><h3 className="mt-3 text-2xl font-black">Roteiros práticos</h3><p className="mt-3 leading-7 text-slate-800">Hospedagem, transporte, atrações, duração ideal e dicas aprendidas em viagens de verdade.</p></article>
        </div>
      </div>
    </section>
  );
}
