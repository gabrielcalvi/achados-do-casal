import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CompartilharPacote from "./CompartilharPacote";

export const dynamic = "force-dynamic";

type Pacote = {
  id: string;
  status: string;
  titulo: string;
  parceiro: string;
  link_afiliado: string;
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
};

async function carregarPacote(id: string) {
  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,
      status,
      titulo,
      parceiro,
      link_afiliado,
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
      destaque
    `)
    .eq("id", id)
    .eq("status", "ativo")
    .maybeSingle();

  if (error || !data) return null;

  const pacote = data as Pacote;
  if (pacote.validade) {
    const validade = new Date(pacote.validade).getTime();
    if (!Number.isFinite(validade) || validade <= Date.now()) return null;
  }

  return pacote;
}

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

function descricao(pacote: Pacote) {
  const preco = pacote.preco_por_pessoa
    ? `${moeda(pacote.preco_por_pessoa, pacote.moeda)} por pessoa`
    : `${moeda(pacote.preco_total, pacote.moeda)} o pacote`;

  return `${pacote.origem_codigo} → ${pacote.destino_codigo} • ${pacote.noites} noites • ${pacote.hotel_nome} • ${preco}. Oferta selecionada pelo Achados do Casal.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pacote = await carregarPacote(id);

  if (!pacote) {
    return {
      title: "Pacote indisponível | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const description = descricao(pacote);
  const url = `https://achadosdocasal.com.br/viagens/pacote/${pacote.id}`;

  return {
    title: `${pacote.titulo} | Achados do Casal`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: pacote.titulo,
      description,
      url,
      siteName: "Achados do Casal",
      type: "website",
      images: pacote.imagem_url
        ? [{ url: pacote.imagem_url, alt: pacote.titulo }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: pacote.titulo,
      description,
      images: pacote.imagem_url ? [pacote.imagem_url] : undefined,
    },
  };
}

export default async function PaginaPacote({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pacote = await carregarPacote(id);

  if (!pacote) notFound();

  const precoPrincipal = pacote.preco_por_pessoa || pacote.preco_total;
  const rotuloPreco = pacote.preco_por_pessoa ? "por pessoa" : "pacote total";
  const textoCompartilhar = descricao(pacote);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="/viagens" className="font-black text-sky-800">
            ← Voltar para Viagens
          </a>
          <span className="text-sm font-black uppercase tracking-wide text-slate-400">
            Achados do Casal
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
            <div className="min-h-[320px] bg-gradient-to-br from-sky-100 to-blue-100 lg:min-h-[620px]">
              {pacote.imagem_url ? (
                <img
                  src={pacote.imagem_url}
                  alt={pacote.titulo}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-8xl">
                  ✈️🏨
                </div>
              )}
            </div>

            <div className="p-6 sm:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-700">
                  {pacote.origem_codigo} → {pacote.destino_codigo}
                </span>
                {pacote.destaque && (
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
                    ⭐ Destaque
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">
                  Oferta parceira • {pacote.parceiro}
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
                {pacote.titulo}
              </h1>

              <p className="mt-3 text-lg font-bold text-slate-700">
                🏨 {pacote.hotel_nome}
                {pacote.hotel_categoria ? ` • ${pacote.hotel_categoria}` : ""}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="text-xs font-black uppercase text-slate-400">Datas</span>
                  <p className="mt-1 font-black">
                    {dataCurta(pacote.data_ida)} a {dataCurta(pacote.data_volta)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <span className="text-xs font-black uppercase text-slate-400">Hospedagem</span>
                  <p className="mt-1 font-black">{pacote.noites} noites</p>
                </div>
              </div>

              <div className="mt-5 space-y-2 text-slate-600">
                <p>👥 {pacote.adultos} adulto{pacote.adultos === 1 ? "" : "s"}{pacote.criancas > 0 ? ` + ${pacote.criancas} criança${pacote.criancas === 1 ? "" : "s"}` : ""}</p>
                {pacote.companhia_aerea && <p>✈️ {pacote.companhia_aerea}</p>}
                {pacote.regime_hospedagem && <p>☕ {pacote.regime_hospedagem}</p>}
                {pacote.bagagem && <p>🧳 {pacote.bagagem}</p>}
              </div>

              <div className="mt-7 border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-500">{rotuloPreco}</p>
                <p className="mt-1 text-4xl font-black text-emerald-700">
                  {moeda(precoPrincipal, pacote.moeda)}
                </p>
                {pacote.preco_por_pessoa && (
                  <p className="mt-1 text-sm text-slate-500">
                    Total informado: {moeda(pacote.preco_total, pacote.moeda)}
                  </p>
                )}
              </div>

              <CompartilharPacote titulo={pacote.titulo} texto={textoCompartilhar} />

              <a
                href={pacote.link_afiliado}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="mt-7 flex w-full items-center justify-center rounded-xl bg-amber-400 px-6 py-4 text-center text-lg font-black text-slate-950 transition hover:bg-amber-300"
              >
                Ver pacote na {pacote.parceiro} ↗
              </a>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Preço e disponibilidade podem mudar no parceiro. O botão acima pode conter link de afiliado; isso não altera o preço para você.
              </p>

              {pacote.observacoes && (
                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                  {pacote.observacoes}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
