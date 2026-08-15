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
};

function moeda(valor: number | null | undefined, codigo = "BRL") {
  if (!Number.isFinite(Number(valor))) {
    return "—";
  }

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
  const partes = [
    `${pacote.adultos} adulto${pacote.adultos === 1 ? "" : "s"}`,
  ];

  if (pacote.criancas > 0) {
    partes.push(
      `${pacote.criancas} criança${pacote.criancas === 1 ? "" : "s"}`
    );
  }

  return partes.join(" + ");
}

export default async function PacotesPublicos() {
  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,
      titulo,
      parceiro,
      link_afiliado,
      radar_slug,
      radar_preco_referencia,
      origem_codigo,
      destino_codigo,
      destino_nome,
      data_ida,
      data_volta,
      hotel_nome,
      hotel_categoria,
      regime_hospedagem,
      noites,
      adultos,
      criancas,
      companhia_aerea,
      bagagem,
      preco_total,
      preco_por_pessoa,
      moeda,
      imagem_url,
      observacoes,
      validade,
      destaque,
      created_at
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
    if (!pacote.validade) {
      return true;
    }

    const validade = new Date(pacote.validade).getTime();
    return Number.isFinite(validade) && validade > agora;
  });

  if (pacotes.length === 0) {
    return null;
  }

  return (
    <section
      id="pacotes-selecionados"
      className="border-y border-amber-200 bg-gradient-to-b from-amber-50 to-white"
    >
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-amber-700">
              ✨ Curadoria Achados do Casal
            </span>

            <h2 className="mt-2 text-3xl font-black sm:text-4xl">
              Pacotes que encontramos
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Combinamos as melhores janelas encontradas pelo Radar com ofertas
              de aéreo + hotel disponíveis em parceiros. O Radar continua
              independente; estes cards são ofertas comerciais selecionadas.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
            Preços e disponibilidade podem mudar no parceiro
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {pacotes.map((pacote) => (
            <article
              key={pacote.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-100 to-blue-100">
                {pacote.imagem_url ? (
                  <img
                    src={pacote.imagem_url}
                    alt={pacote.titulo}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl">
                    ✈️🏨
                  </div>
                )}

                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {pacote.destaque && (
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 shadow-sm">
                      ⭐ Destaque
                    </span>
                  )}

                  {pacote.radar_slug && (
                    <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-black text-white shadow-sm">
                      📡 Janela do Radar
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-700">
                    {pacote.origem_codigo} → {pacote.destino_codigo}
                  </span>

                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Oferta parceira • {pacote.parceiro}
                  </span>
                </div>

                <h3 className="mt-4 text-2xl font-black leading-tight text-slate-950">
                  {pacote.titulo}
                </h3>

                <p className="mt-2 font-bold text-slate-700">
                  🏨 {pacote.hotel_nome}
                  {pacote.hotel_categoria ? ` • ${pacote.hotel_categoria}` : ""}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="block text-xs font-bold uppercase text-slate-400">
                      Datas
                    </span>
                    <strong className="mt-1 block text-slate-800">
                      {dataCurta(pacote.data_ida)} a {dataCurta(pacote.data_volta)}
                    </strong>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="block text-xs font-bold uppercase text-slate-400">
                      Hospedagem
                    </span>
                    <strong className="mt-1 block text-slate-800">
                      {pacote.noites} noites
                    </strong>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>👥 {passageiros(pacote)}</p>
                  {pacote.companhia_aerea && (
                    <p>✈️ {pacote.companhia_aerea}</p>
                  )}
                  {pacote.regime_hospedagem && (
                    <p>☕ {pacote.regime_hospedagem}</p>
                  )}
                  {pacote.bagagem && <p>🧳 {pacote.bagagem}</p>}
                </div>

                {pacote.radar_slug && pacote.radar_preco_referencia && (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                      📡 Referência do Radar
                    </p>
                    <p className="mt-1 text-sm font-bold text-violet-950">
                      Voo encontrado a {moeda(pacote.radar_preco_referencia, pacote.moeda)} por pessoa
                    </p>
                  </div>
                )}

                <div className="mt-5 border-t border-slate-100 pt-5">
                  {pacote.preco_por_pessoa ? (
                    <>
                      <p className="text-sm font-bold text-slate-500">
                        Pacote por pessoa
                      </p>
                      <p className="mt-1 text-3xl font-black text-emerald-700">
                        {moeda(pacote.preco_por_pessoa, pacote.moeda)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Total informado: {moeda(pacote.preco_total, pacote.moeda)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-500">
                        Pacote total
                      </p>
                      <p className="mt-1 text-3xl font-black text-emerald-700">
                        {moeda(pacote.preco_total, pacote.moeda)}
                      </p>
                    </>
                  )}
                </div>

                {pacote.observacoes && (
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {pacote.observacoes}
                  </p>
                )}

                <div className="mt-6 grid gap-3">
                  <a
                    href={`/viagens/pacote/${pacote.id}`}
                    className="flex w-full items-center justify-center rounded-xl border-2 border-sky-700 bg-white px-5 py-3 text-center font-black text-sky-800 transition hover:bg-sky-50"
                  >
                    🔗 Ver e compartilhar
                  </a>

                  <a
                    href={pacote.link_afiliado}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="flex w-full items-center justify-center rounded-xl bg-amber-400 px-5 py-4 text-center font-black text-slate-950 transition hover:bg-amber-300"
                  >
                    Ver pacote na {pacote.parceiro} ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
