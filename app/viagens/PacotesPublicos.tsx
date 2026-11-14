import { supabaseAdmin } from "@/lib/supabase/admin";

type TipoOferta = "pacote" | "hotel" | "ingresso" | "carro" | "cruzeiro" | "passeio" | "outro";

type OfertaPublica = {
  id: string;
  tipo: TipoOferta;
  titulo: string;
  parceiro: string;
  link_afiliado: string;
  radar_slug: string | null;
  radar_preco_referencia: number | null;
  origem_codigo: string | null;
  destino_codigo: string | null;
  destino_nome: string | null;
  local_nome: string | null;
  cidade_uf: string | null;
  data_ida: string | null;
  data_volta: string | null;
  hotel_nome: string | null;
  hotel_categoria: string | null;
  regime_hospedagem: string | null;
  noites: number | null;
  adultos: number;
  criancas: number;
  companhia_aerea: string | null;
  bagagem: string | null;
  preco_total: number;
  impostos_taxas_encargos: number | null;
  preco_total_final: number | null;
  preco_por_pessoa: number | null;
  moeda: string;
  imagem_url: string | null;
  observacoes: string | null;
  validade: string | null;
  destaque: boolean;
  created_at: string;
  disponibilidade_status: string | null;
};

const CONFIG: Record<TipoOferta, { label: string; icon: string; cor: string }> = {
  pacote: { label: "Pacote", icon: "✈️🏨", cor: "bg-sky-700" },
  hotel: { label: "Hotel", icon: "🏨", cor: "bg-emerald-700" },
  ingresso: { label: "Ingresso", icon: "🎟️", cor: "bg-violet-700" },
  carro: { label: "Carro", icon: "🚗", cor: "bg-cyan-700" },
  cruzeiro: { label: "Cruzeiro", icon: "🚢", cor: "bg-blue-800" },
  passeio: { label: "Passeio", icon: "🎡", cor: "bg-fuchsia-700" },
  outro: { label: "Oferta", icon: "✨", cor: "bg-slate-700" },
};

function moeda(valor: number | null | undefined, codigo = "BRL") {
  if (!Number.isFinite(Number(valor))) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: codigo,
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

function dataCurta(valor: string | null) {
  if (!valor) return null;
  return new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function periodo(oferta: OfertaPublica) {
  const ida = dataCurta(oferta.data_ida);
  const volta = dataCurta(oferta.data_volta);
  if (ida && volta) return `${ida} a ${volta}`;
  if (ida) return ida;
  return null;
}

function localOferta(oferta: OfertaPublica) {
  if (oferta.tipo === "pacote" && oferta.origem_codigo && oferta.destino_codigo) {
    return `${oferta.origem_codigo} → ${oferta.destino_codigo}`;
  }
  return oferta.cidade_uf || oferta.local_nome || oferta.destino_nome || null;
}

function principal(oferta: OfertaPublica) {
  if (oferta.tipo === "hotel") return oferta.hotel_nome || oferta.local_nome;
  if (oferta.tipo === "pacote") return oferta.hotel_nome;
  return oferta.local_nome || oferta.destino_nome;
}

function disponibilidadePublicavel(oferta: OfertaPublica) {
  if (oferta.tipo !== "pacote") return true;
  const valor = String(oferta.disponibilidade_status || "nao_verificado").toLowerCase();
  return valor === "disponivel" || valor === "nao_verificado";
}

function passageiros(oferta: OfertaPublica) {
  const partes = [`${oferta.adultos} adulto${oferta.adultos === 1 ? "" : "s"}`];
  if (oferta.criancas > 0) {
    partes.push(`${oferta.criancas} criança${oferta.criancas === 1 ? "" : "s"}`);
  }
  return partes.join(" + ");
}

function precoPrincipal(oferta: OfertaPublica) {
  return oferta.preco_total_final || oferta.preco_por_pessoa || oferta.preco_total;
}

function rotuloPreco(oferta: OfertaPublica) {
  if (oferta.preco_total_final) return "Total final com impostos e taxas";
  if (oferta.preco_por_pessoa) return "Por pessoa";
  if (oferta.tipo === "hotel") return "Valor da hospedagem";
  if (oferta.tipo === "carro") return "Valor da locação";
  if (oferta.tipo === "ingresso") return "Valor do ingresso";
  if (oferta.tipo === "cruzeiro") return "Valor do cruzeiro";
  return "Valor da oferta";
}

export default async function PacotesPublicos() {
  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,tipo,titulo,parceiro,link_afiliado,radar_slug,radar_preco_referencia,
      origem_codigo,destino_codigo,destino_nome,local_nome,cidade_uf,data_ida,data_volta,
      hotel_nome,hotel_categoria,regime_hospedagem,noites,adultos,criancas,
      companhia_aerea,bagagem,preco_total,impostos_taxas_encargos,preco_total_final,
      preco_por_pessoa,moeda,imagem_url,observacoes,validade,destaque,created_at,
      disponibilidade_status
    `)
    .eq("status", "ativo")
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.error("[Viagens] Falha ao carregar ofertas públicas:", error);
    return null;
  }

  const agora = Date.now();
  const ofertas = ((data ?? []) as OfertaPublica[]).filter((oferta) => {
    if (!disponibilidadePublicavel(oferta)) return false;
    if (!oferta.validade) return true;
    const validade = new Date(oferta.validade).getTime();
    return Number.isFinite(validade) && validade > agora;
  });

  if (ofertas.length === 0) return null;

  const destaque = ofertas[0];
  const demais = ofertas.slice(1);
  const destaqueCfg = CONFIG[destaque.tipo] || CONFIG.outro;

  return (
    <section id="pacotes-selecionados" className="border-y border-amber-200 bg-gradient-to-b from-amber-50 to-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-amber-700">Curadoria Achados do Casal</span>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Ofertas de viagem que encontramos</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Pacotes, hotéis, ingressos, aluguel de carro, cruzeiros e experiências em um só lugar.
              Cada oferta mostra apenas as informações que realmente fazem sentido para aquele tipo.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
            Preços e disponibilidade podem mudar no parceiro
          </span>
        </div>

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-[320px] bg-gradient-to-br from-sky-100 to-blue-100 lg:min-h-[460px]">
              {destaque.imagem_url ? (
                <img src={destaque.imagem_url} alt={destaque.titulo} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-7xl">{destaqueCfg.icon}</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent p-6 text-white sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black text-white ${destaqueCfg.cor}`}>{destaqueCfg.label}</span>
                  {destaque.destaque ? <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">Destaque</span> : null}
                  {destaque.tipo === "pacote" && destaque.radar_slug ? <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-black text-white">Janela do Radar</span> : null}
                </div>
                {localOferta(destaque) ? <p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-sky-100">{localOferta(destaque)}</p> : null}
                <h3 className="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{destaque.titulo}</h3>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-400">Oferta parceira • {destaque.parceiro}</span>
                {destaque.noites ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{destaque.noites} noites</span> : null}
              </div>

              {principal(destaque) ? (
                <p className="mt-5 text-xl font-black text-slate-900">
                  {principal(destaque)}
                  {destaque.hotel_categoria ? ` • ${destaque.hotel_categoria}` : ""}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {periodo(destaque) ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <span className="block text-xs font-bold uppercase text-slate-400">Período</span>
                    <strong className="mt-1 block text-slate-800">{periodo(destaque)}</strong>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase text-slate-400">Viajantes</span>
                  <strong className="mt-1 block text-slate-800">{passageiros(destaque)}</strong>
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm text-slate-600">
                {destaque.companhia_aerea ? <p>Companhia: <strong className="text-slate-800">{destaque.companhia_aerea}</strong></p> : null}
                {destaque.regime_hospedagem ? <p>Hospedagem: <strong className="text-slate-800">{destaque.regime_hospedagem}</strong></p> : null}
                {destaque.bagagem ? <p>Bagagem: <strong className="text-slate-800">{destaque.bagagem}</strong></p> : null}
              </div>

              {destaque.tipo === "pacote" && destaque.radar_slug && destaque.radar_preco_referencia ? (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-violet-700">Por que entrou na nossa curadoria?</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-violet-950">
                    O Radar encontrou voo para esta janela a {moeda(destaque.radar_preco_referencia, destaque.moeda)} por pessoa.
                  </p>
                </div>
              ) : null}

              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{rotuloPreco(destaque)}</p>
                <p className="mt-1 text-4xl font-black text-emerald-700">{moeda(precoPrincipal(destaque), destaque.moeda)}</p>
                {destaque.preco_total_final && destaque.impostos_taxas_encargos ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Anunciado: {moeda(destaque.preco_total, destaque.moeda)} + taxas: {moeda(destaque.impostos_taxas_encargos, destaque.moeda)}
                  </p>
                ) : null}
              </div>

              {destaque.observacoes ? <p className="mt-4 text-sm leading-6 text-slate-500">{destaque.observacoes}</p> : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a href={`/viagens/pacote/${destaque.id}`} className="flex items-center justify-center rounded-xl border-2 border-sky-700 bg-white px-5 py-3 text-center font-black text-sky-800 transition hover:bg-sky-50">Ver e compartilhar</a>
                <a href={destaque.link_afiliado} target="_blank" rel="sponsored noopener noreferrer" className="flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-center font-black text-slate-950 transition hover:bg-amber-300">Ver na {destaque.parceiro} ↗</a>
              </div>
            </div>
          </div>
        </div>

        {demais.length > 0 ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {demais.map((oferta) => {
              const cfg = CONFIG[oferta.tipo] || CONFIG.outro;
              return (
                <article key={oferta.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-sky-100 to-blue-100">
                    {oferta.imagem_url ? (
                      <img src={oferta.imagem_url} alt={oferta.titulo} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">{cfg.icon}</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-5 text-white">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black text-white ${cfg.cor}`}>{cfg.label}</span>
                        {oferta.tipo === "pacote" && oferta.radar_slug ? <span className="rounded-full bg-violet-700 px-2.5 py-1 text-[11px] font-black text-white">Janela do Radar</span> : null}
                      </div>
                      {localOferta(oferta) ? <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-sky-100">{localOferta(oferta)}</p> : null}
                      <h3 className="mt-1 text-xl font-black leading-tight">{oferta.titulo}</h3>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Oferta parceira • {oferta.parceiro}</span>

                    {principal(oferta) ? (
                      <p className="mt-4 text-base font-black text-slate-900">
                        {principal(oferta)}{oferta.hotel_categoria ? ` • ${oferta.hotel_categoria}` : ""}
                      </p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      {periodo(oferta) ? (
                        <div className="rounded-xl bg-slate-50 p-3">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Período</span>
                          <strong className="mt-1 block leading-5 text-slate-800">{periodo(oferta)}</strong>
                        </div>
                      ) : null}
                      {oferta.noites ? (
                        <div className="rounded-xl bg-slate-50 p-3">
                          <span className="block text-[10px] font-bold uppercase text-slate-400">Duração</span>
                          <strong className="mt-1 block leading-5 text-slate-800">{oferta.noites} noites</strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{rotuloPreco(oferta)}</p>
                      <p className="mt-1 text-3xl font-black text-emerald-700">{moeda(precoPrincipal(oferta), oferta.moeda)}</p>
                    </div>

                    {oferta.observacoes ? <p className="mt-3 text-xs leading-5 text-slate-500">{oferta.observacoes}</p> : null}

                    <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
                      <a href={`/viagens/pacote/${oferta.id}`} className="flex items-center justify-center rounded-xl border-2 border-sky-700 bg-white px-4 py-3 text-center text-sm font-black text-sky-800 transition hover:bg-sky-50">Ver e compartilhar</a>
                      <a href={oferta.link_afiliado} target="_blank" rel="sponsored noopener noreferrer" className="flex items-center justify-center rounded-xl bg-amber-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-amber-300">Ver na {oferta.parceiro} ↗</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
