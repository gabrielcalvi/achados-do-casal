import { supabaseAdmin } from "@/lib/supabase/admin";

type IngressoPublico = {
  id: string;
  titulo: string;
  parceiro: string;
  link_afiliado: string;
  atracao_nome: string;
  cidade_uf: string | null;
  data_uso: string | null;
  adultos: number;
  criancas: number;
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

function viajantes(item: IngressoPublico) {
  const partes: string[] = [];
  if (item.adultos > 0) partes.push(`${item.adultos} adulto${item.adultos === 1 ? "" : "s"}`);
  if (item.criancas > 0) partes.push(`${item.criancas} criança${item.criancas === 1 ? "" : "s"}`);
  return partes.join(" + ");
}

export default async function IngressosPublicos() {
  const { data, error } = await supabaseAdmin
    .from("viagens_ingressos")
    .select("id,titulo,parceiro,link_afiliado,atracao_nome,cidade_uf,data_uso,adultos,criancas,preco_total,preco_por_pessoa,moeda,imagem_url,observacoes,validade,destaque,created_at")
    .eq("status", "ativo")
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[Viagens] Falha ao carregar ingressos públicos:", error);
    return null;
  }

  const agora = Date.now();
  const ingressos = ((data ?? []) as IngressoPublico[]).filter((item) => {
    if (!item.validade) return true;
    const validade = new Date(item.validade).getTime();
    return Number.isFinite(validade) && validade > agora;
  });

  if (ingressos.length === 0) return null;

  return (
    <section id="ingressos-experiencias" className="border-y border-fuchsia-100 bg-gradient-to-b from-fuchsia-50/70 to-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-fuchsia-700">Ingressos e experiências</span>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Parques, passeios e atrações</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">Ofertas selecionadas de parques, passeios e atrações para aproveitar mais a viagem e pagar menos.</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">Disponibilidade pode mudar no parceiro</span>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ingressos.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-fuchsia-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <a href={`/viagens/ingresso/${item.id}`} className="block">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-fuchsia-100 via-violet-100 to-sky-100">
                  {item.imagem_url ? (
                    <img src={item.imagem_url} alt={item.titulo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-6xl">🎟️</div>
                  )}
                  <div className="absolute left-4 top-4 flex gap-2">
                    <span className="rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-black text-white">Ingresso</span>
                    {item.destaque ? <span className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950">Destaque</span> : null}
                  </div>
                </div>
              </a>

              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-wide text-fuchsia-700">{item.cidade_uf || "Experiência"}</p>
                <a href={`/viagens/ingresso/${item.id}`} className="block">
                  <h3 className="mt-2 text-xl font-black leading-tight text-slate-950 transition hover:text-fuchsia-700">{item.titulo}</h3>
                </a>
                <p className="mt-2 font-bold text-slate-600">{item.atracao_nome}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  {item.data_uso ? <span className="rounded-full bg-slate-100 px-3 py-2">📅 {dataCurta(item.data_uso)}</span> : null}
                  {viajantes(item) ? <span className="rounded-full bg-slate-100 px-3 py-2">👥 {viajantes(item)}</span> : null}
                </div>

                {item.observacoes ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">{item.observacoes}</p> : null}

                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.preco_por_pessoa ? "Por pessoa" : "Preço informado"}</p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">{moeda(item.preco_por_pessoa || item.preco_total, item.moeda)}</p>
                  {item.preco_por_pessoa ? <p className="mt-1 text-xs text-slate-500">Total informado: {moeda(item.preco_total, item.moeda)}</p> : null}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <a href={`/viagens/ingresso/${item.id}`} className="flex w-full items-center justify-center rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3 text-center font-black text-fuchsia-800 transition hover:bg-fuchsia-100">Abrir produto</a>
                  <a href={item.link_afiliado} target="_blank" rel="sponsored noopener noreferrer" className="flex w-full items-center justify-center rounded-xl bg-fuchsia-600 px-4 py-3 text-center font-black text-white transition hover:bg-fuchsia-700">Ver na {item.parceiro} ↗</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
