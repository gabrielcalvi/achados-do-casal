import { supabaseAdmin } from "@/lib/supabase/admin";

type PacotePublico = {
  id: string;
  titulo: string;
  parceiro: string;
  link_afiliado: string;
  radar_slug: string | null;
  radar_preco_referencia: number | null;
  origem_codigo: string;
  destino_codigo: string;
  destino_nome: string | null;
  data_ida: string;
  data_volta: string;
  hotel_nome: string;
  hotel_categoria: string | null;
  regime_hospedagem: string | null;
  noites: number;
  adultos: number;
  criancas: number;
  companhia_aerea: string | null;
  bagagem: string | null;
  preco_total: number;
  preco_por_pessoa: number | null;
  moeda: string;
  imagem_url: string | null;
  observacoes: string | null;
  validade: string | null;
  destaque: boolean;
  created_at: string;
  disponibilidade_status: string | null;
};

function moeda(valor: number | null | undefined, codigo = "BRL") {
  if (!Number.isFinite(Number(valor))) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: codigo,
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

function dataCurta(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function passageiros(pacote: PacotePublico) {
  const partes = [`${pacote.adultos} adulto${pacote.adultos === 1 ? "" : "s"}`];
  if (pacote.criancas > 0) {
    partes.push(`${pacote.criancas} criança${pacote.criancas === 1 ? "" : "s"}`);
  }
  return partes.join(" + ");
}

function disponibilidadePublicavel(status: string | null) {
  const valor = String(status || "nao_verificado").toLowerCase();
  return valor === "disponivel" || valor === "nao_verificado";
}

export default async function PacotesPublicos() {
  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,titulo,parceiro,link_afiliado,radar_slug,radar_preco_referencia,
      origem_codigo,destino_codigo,destino_nome,data_ida,data_volta,
      hotel_nome,hotel_categoria,regime_hospedagem,noites,adultos,criancas,
      companhia_aerea,bagagem,preco_total,preco_por_pessoa,moeda,imagem_url,
      observacoes,validade,destaque,created_at,disponibilidade_status
    `)
    .eq("status", "ativo")
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[Viagens] Falha ao carregar pacotes públicos:", error);
    return null;
  }

  const agora = Date.now();
  const pacotes = ((data ?? []) as PacotePublico[]).filter((pacote) => {
    if (!disponibilidadePublicavel(pacote.disponibilidade_status)) return false;
    if (!pacote.validade) return true;
    const validade = new Date(pacote.validade).getTime();
    return Number.isFinite(validade) && validade > agora;
  });

  if (pacotes.length === 0) return null;

  const pacoteDestaque = pacotes[0];
  const demais = pacotes.slice(1);

  return (
    <section id="pacotes-selecionados" className="border-y border-amber-200 bg-gradient-to-b from-amber-50 to-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-amber-700">Curadoria Achados do Casal</span>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Pacotes que encontramos</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Quando uma janela do Radar encontra um pacote que merece atenção, a gente destaca aqui. O ranking do Radar continua independente da parceria comercial.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
            Preços e disponibilidade podem mudar no parceiro
          </span>
        </div>

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[320px] bg-gradient-to-br from-sky-100 to-blue-100 lg:min-h-[460px]">
              {pacoteDestaque.imagem_url ? (
                <img src={pacoteDestaque.imagem_url} alt={pacoteDestaque.titulo} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-7xl">✈️🏨</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent p-6 text-white sm:p-8">
                <div className="flex flex-wrap gap-2">
                  {pacoteDestaque.destaque ? <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">Destaque</span> : null}
                  {pacoteDestaque.radar_slug ? <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-black text-white">Janela do Radar</span> : null}
                </div>
                <p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-sky-100">
                  {pacoteDestaque.origem_codigo} → {pacoteDestaque.destino_codigo}
                </p>
                <h3 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{pacoteDestaque.titulo}</h3>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Oferta parceira • {pacoteDestaque.parceiro}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{pacoteDestaque.noites} noites</span>
              </div>

              <p className="mt-5 text-xl font-black text-slate-900">
                {pacoteDestaque.hotel_nome}{pacoteDestaque.hotel_categoria ? ` • ${pacoteDestaque.hotel_categoria}` : ""}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase text-slate-400">Datas</span>
                  <strong className="mt-1 block text-slate-800">{dataCurta(pacoteDestaque.data_ida)} a {dataCurta(pacoteDestaque.data_volta)}</strong>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase text-slate-400">Viajantes</span>
                  <strong className="mt-1 block text-slate-800">{passageiros(pacoteDestaque)}</strong>
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                {pacoteDestaque.companhia_aerea ? <p>Companhia: <strong className="text-slate-800">{pacoteDestaque.companhia_aerea}</strong></p> : null}
                {pacoteDestaque.regime_hospedagem ? <p>Hospedagem: <strong className="text-slate-800">{pacoteDestaque.regime_hospedagem}</strong></p> : null}
                {pacoteDestaque.bagagem ? <p>Bagagem: <strong className="text-slate-800">{pacoteDestaque.bagagem}</strong></p> : null}
              </div>

              {pacoteDestaque.radar_slug && pacoteDestaque.radar_preco_referencia ? (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-violet-700">Por que entrou na nossa curadoria?</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-violet-950">
                    O Radar encontrou voo para esta janela a {moeda(pacoteDestaque.radar_preco_referencia, pacoteDestaque.moeda)} por pessoa. Aqui comparamos a oportunidade com o pacote completo de aéreo + hotel.
                  </p>
                </div>
              ) : null}

              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-sm font-bold text-slate-500">{pacoteDestaque.preco_por_pessoa ? "Pacote por pessoa" : "Pacote total"}</p>
                <p className="mt-1 text-4xl font-black text-emerald-700">
                  {moeda(pacoteDestaque.preco_por_pessoa || pacoteDestaque.preco_total, pacoteDestaque.moeda)}
                </p>
                {pacoteDestaque.preco_por_pessoa ? <p className="mt-1 text-sm text-slate-500">Total informado: {moeda(pacoteDestaque.preco_total, pacoteDestaque.moeda)}</p> : null}
              </div>

              {pacoteDestaque.observacoes ? <p className="mt-4 text-sm leading-6 text-slate-500">{pacoteDestaque.observacoes}</p> : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a href={`/viagens/pacote/${pacoteDestaque.id}`} className="flex items-center justify-center rounded-xl border-2 border-sky-700 bg-white px-5 py-3 text-center font-black text-sky-800 transition hover:bg-sky-50">Ver e compartilhar</a>
                <a href={pacoteDestaque.link_afiliado} target="_blank" rel="sponsored noopener noreferrer" className="flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-center font-black text-slate-950 transition hover:bg-amber-300">Ver na {pacoteDestaque.parceiro} ↗</a>
              </div>
            </div>
          </div>
        </div>

        {demais.length > 0 ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {demais.map((pacote) => (
              <article key={pacote.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-100 to-blue-100">
                  {pacote.imagem_url ? (
                    <img src={pacote.imagem_url} alt={pacote.titulo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">✈️🏨</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-5 text-white">
                    <div className="flex flex-wrap gap-2">
                      {pacote.radar_slug ? <span className="rounded-full bg-violet-700 px-2.5 py-1 text-[11px] font-black text-white">Janela do Radar</span> : null}
                    </div>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-sky-100">{pacote.origem_codigo} → {pacote.destino_codigo}</p>
                    <h3 className="mt-1 text-xl font-black leading-tight">{pacote.titulo}</h3>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Oferta parceira • {pacote.parceiro}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{pacote.noites} noites</span>
                  </div>

                  <p className="mt-4 text-base font-black text-slate-900">
                    {pacote.hotel_nome}{pacote.hotel_categoria ? ` • ${pacote.hotel_categoria}` : ""}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Datas</span>
                      <strong className="mt-1 block leading-5 text-slate-800">{dataCurta(pacote.data_ida)} a {dataCurta(pacote.data_volta)}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Viajantes</span>
                      <strong className="mt-1 block leading-5 text-slate-800">{passageiros(pacote)}</strong>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs leading-5 text-slate-600">
                    {pacote.companhia_aerea ? <p>Companhia: <strong className="text-slate-800">{pacote.companhia_aerea}</strong></p> : null}
                    {pacote.regime_hospedagem ? <p>Hospedagem: <strong className="text-slate-800">{pacote.regime_hospedagem}</strong></p> : null}
                    {pacote.bagagem ? <p>Bagagem: <strong className="text-slate-800">{pacote.bagagem}</strong></p> : null}
                  </div>

                  {pacote.radar_slug && pacote.radar_preco_referencia ? (
                    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">Por que entrou na curadoria?</p>
                      <p className="mt-1.5 text-xs font-bold leading-5 text-violet-950">
                        O Radar encontrou voo nesta janela a {moeda(pacote.radar_preco_referencia, pacote.moeda)} por pessoa. Aqui comparamos com o pacote de aéreo + hotel.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold text-slate-500">{pacote.preco_por_pessoa ? "Pacote por pessoa" : "Pacote total"}</p>
                    <p className="mt-1 text-3xl font-black text-emerald-700">{moeda(pacote.preco_por_pessoa || pacote.preco_total, pacote.moeda)}</p>
                    {pacote.preco_por_pessoa ? <p className="mt-1 text-xs text-slate-500">Total informado: {moeda(pacote.preco_total, pacote.moeda)}</p> : null}
                  </div>

                  {pacote.observacoes ? <p className="mt-3 text-xs leading-5 text-slate-500">{pacote.observacoes}</p> : null}

                  <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
                    <a href={`/viagens/pacote/${pacote.id}`} className="flex items-center justify-center rounded-xl border-2 border-sky-700 bg-white px-4 py-3 text-center text-sm font-black text-sky-800 transition hover:bg-sky-50">Ver e compartilhar</a>
                    <a href={pacote.link_afiliado} target="_blank" rel="sponsored noopener noreferrer" className="flex items-center justify-center rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-amber-300">Ver na {pacote.parceiro} ↗</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
