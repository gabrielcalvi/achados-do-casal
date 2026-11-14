import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CompartilharPacote from "./CompartilharPacote";

export const dynamic = "force-dynamic";

type TipoOferta = "pacote" | "hotel" | "ingresso" | "carro" | "cruzeiro" | "passeio" | "outro";

type Oferta = {
  id: string;
  status: string;
  tipo: TipoOferta;
  titulo: string;
  parceiro: string;
  link_afiliado: string;
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
  disponibilidade_status: string | null;
};

const CONFIG: Record<TipoOferta, { label: string; icon: string }> = {
  pacote: { label: "Pacote", icon: "✈️🏨" },
  hotel: { label: "Hotel", icon: "🏨" },
  ingresso: { label: "Ingresso", icon: "🎟️" },
  carro: { label: "Aluguel de carro", icon: "🚗" },
  cruzeiro: { label: "Cruzeiro", icon: "🚢" },
  passeio: { label: "Passeio / experiência", icon: "🎡" },
  outro: { label: "Oferta de viagem", icon: "✨" },
};

async function carregarOferta(id: string) {
  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,status,tipo,titulo,parceiro,link_afiliado,
      origem_codigo,destino_codigo,destino_nome,local_nome,cidade_uf,
      data_ida,data_volta,hotel_nome,hotel_categoria,regime_hospedagem,noites,
      adultos,criancas,companhia_aerea,bagagem,preco_total,impostos_taxas_encargos,
      preco_total_final,preco_por_pessoa,moeda,imagem_url,observacoes,validade,
      destaque,disponibilidade_status
    `)
    .eq("id", id)
    .eq("status", "ativo")
    .maybeSingle();

  if (error || !data) return null;

  const oferta = data as Oferta;
  if (oferta.tipo === "pacote") {
    const disponibilidade = String(oferta.disponibilidade_status || "nao_verificado").toLowerCase();
    if (disponibilidade !== "disponivel" && disponibilidade !== "nao_verificado") return null;
  }

  if (oferta.validade) {
    const validade = new Date(oferta.validade).getTime();
    if (!Number.isFinite(validade) || validade <= Date.now()) return null;
  }

  return oferta;
}

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

function periodo(oferta: Oferta) {
  const ida = dataCurta(oferta.data_ida);
  const volta = dataCurta(oferta.data_volta);
  if (ida && volta) return `${ida} a ${volta}`;
  if (ida) return ida;
  return null;
}

function localOferta(oferta: Oferta) {
  if (oferta.tipo === "pacote" && oferta.origem_codigo && oferta.destino_codigo) {
    return `${oferta.origem_codigo} → ${oferta.destino_codigo}`;
  }
  return oferta.cidade_uf || oferta.local_nome || oferta.destino_nome || null;
}

function nomePrincipal(oferta: Oferta) {
  if (oferta.tipo === "hotel") return oferta.hotel_nome || oferta.local_nome;
  if (oferta.tipo === "pacote") return oferta.hotel_nome;
  return oferta.local_nome || oferta.destino_nome;
}

function descricao(oferta: Oferta) {
  const cfg = CONFIG[oferta.tipo] || CONFIG.outro;
  const preco = oferta.preco_total_final
    ? `${moeda(oferta.preco_total_final, oferta.moeda)} total final`
    : oferta.preco_por_pessoa
      ? `${moeda(oferta.preco_por_pessoa, oferta.moeda)} por pessoa`
      : `${moeda(oferta.preco_total, oferta.moeda)}`;

  const partes = [cfg.label, oferta.titulo];
  const local = localOferta(oferta);
  if (local) partes.push(local);
  if (oferta.noites) partes.push(`${oferta.noites} noites`);
  const principal = nomePrincipal(oferta);
  if (principal && principal !== oferta.titulo) partes.push(principal);
  partes.push(preco);
  return `${partes.join(" • ")}. Oferta selecionada pelo Achados do Casal.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const oferta = await carregarOferta(id);

  if (!oferta) {
    return {
      title: "Oferta indisponível | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const cfg = CONFIG[oferta.tipo] || CONFIG.outro;
  const description = descricao(oferta);
  const url = `https://achadosdocasal.com.br/viagens/pacote/${oferta.id}`;

  return {
    title: `${cfg.label}: ${oferta.titulo} | Achados do Casal`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${cfg.label}: ${oferta.titulo}`,
      description,
      url,
      siteName: "Achados do Casal",
      type: "website",
      images: oferta.imagem_url ? [{ url: oferta.imagem_url, alt: oferta.titulo }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${cfg.label}: ${oferta.titulo}`,
      description,
      images: oferta.imagem_url ? [oferta.imagem_url] : undefined,
    },
  };
}

export default async function PaginaOferta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const oferta = await carregarOferta(id);
  if (!oferta) notFound();

  const cfg = CONFIG[oferta.tipo] || CONFIG.outro;
  const precoPrincipal = oferta.preco_total_final || oferta.preco_por_pessoa || oferta.preco_total;
  const rotuloPreco = oferta.preco_total_final
    ? "TOTAL FINAL com impostos e taxas"
    : oferta.preco_por_pessoa
      ? "por pessoa"
      : oferta.tipo === "hotel"
        ? "valor da hospedagem"
        : oferta.tipo === "carro"
          ? "valor da locação"
          : oferta.tipo === "ingresso"
            ? "valor do ingresso"
            : oferta.tipo === "cruzeiro"
              ? "valor do cruzeiro"
              : "valor da oferta";

  const textoCompartilhar = descricao(oferta);
  const local = localOferta(oferta);
  const principal = nomePrincipal(oferta);
  const datas = periodo(oferta);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="/viagens" className="font-black text-sky-800">← Voltar para Viagens</a>
          <span className="text-sm font-black uppercase tracking-wide text-slate-400">Achados do Casal</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
            <div className="min-h-[320px] bg-gradient-to-br from-sky-100 to-blue-100 lg:min-h-[620px]">
              {oferta.imagem_url ? (
                <img src={oferta.imagem_url} alt={oferta.titulo} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-8xl">{cfg.icon}</div>
              )}
            </div>

            <div className="p-6 sm:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                  {cfg.icon} {cfg.label}
                </span>
                {local ? (
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-700">{local}</span>
                ) : null}
                {oferta.destaque ? (
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">⭐ Destaque</span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">
                  Oferta parceira • {oferta.parceiro}
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{oferta.titulo}</h1>

              {principal ? (
                <p className="mt-3 text-lg font-bold text-slate-700">
                  {oferta.tipo === "hotel" || oferta.tipo === "pacote" ? "🏨 " : ""}
                  {principal}
                  {oferta.hotel_categoria ? ` • ${oferta.hotel_categoria}` : ""}
                </p>
              ) : null}

              <div className="mt-6 grid grid-cols-2 gap-3">
                {datas ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <span className="text-xs font-black uppercase text-slate-400">Período</span>
                    <p className="mt-1 font-black">{datas}</p>
                  </div>
                ) : null}
                {oferta.noites ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <span className="text-xs font-black uppercase text-slate-400">Duração</span>
                    <p className="mt-1 font-black">{oferta.noites} noites</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-2 text-slate-600">
                <p>👥 {oferta.adultos} adulto{oferta.adultos === 1 ? "" : "s"}{oferta.criancas > 0 ? ` + ${oferta.criancas} criança${oferta.criancas === 1 ? "" : "s"}` : ""}</p>
                {oferta.companhia_aerea ? <p>✈️ {oferta.companhia_aerea}</p> : null}
                {oferta.regime_hospedagem ? <p>☕ {oferta.regime_hospedagem}</p> : null}
                {oferta.bagagem ? <p>🧳 {oferta.bagagem}</p> : null}
              </div>

              <div className="mt-7 border-t border-slate-200 pt-6">
                <p className={`text-sm font-black ${oferta.preco_total_final ? "uppercase tracking-wide text-emerald-700" : "text-slate-500"}`}>{rotuloPreco}</p>
                <p className="mt-1 text-4xl font-black text-emerald-700">{moeda(precoPrincipal, oferta.moeda)}</p>

                {oferta.preco_total_final ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-bold text-amber-900">Valor anunciado pelo parceiro</span>
                      <strong>{moeda(oferta.preco_total, oferta.moeda)}</strong>
                    </div>
                    {oferta.impostos_taxas_encargos ? (
                      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                        <span className="font-bold text-amber-900">Impostos, taxas e encargos</span>
                        <strong>+ {moeda(oferta.impostos_taxas_encargos, oferta.moeda)}</strong>
                      </div>
                    ) : null}
                  </div>
                ) : oferta.preco_por_pessoa ? (
                  <p className="mt-1 text-sm text-slate-500">Total informado: {moeda(oferta.preco_total, oferta.moeda)}</p>
                ) : null}
              </div>

              <CompartilharPacote titulo={oferta.titulo} texto={textoCompartilhar} />

              <a
                href={oferta.link_afiliado}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="mt-7 flex w-full items-center justify-center rounded-xl bg-amber-400 px-6 py-4 text-center text-lg font-black text-slate-950 transition hover:bg-amber-300"
              >
                Ver oferta na {oferta.parceiro} ↗
              </a>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Preço e disponibilidade podem mudar no parceiro. O botão acima pode conter link de afiliado; isso não altera o preço para você.
              </p>

              {oferta.observacoes ? (
                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">{oferta.observacoes}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
