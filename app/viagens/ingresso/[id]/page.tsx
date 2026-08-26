import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CompartilharIngresso from "./CompartilharIngresso";

export const dynamic = "force-dynamic";

type Ingresso = {
  id: string;
  status: string;
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
};

async function carregarIngresso(id: string) {
  const { data, error } = await supabaseAdmin
    .from("viagens_ingressos")
    .select("id,status,titulo,parceiro,link_afiliado,atracao_nome,cidade_uf,data_uso,adultos,criancas,preco_total,preco_por_pessoa,moeda,imagem_url,observacoes,validade,destaque")
    .eq("id", id)
    .eq("status", "ativo")
    .maybeSingle();

  if (error || !data) return null;

  const ingresso = data as Ingresso;
  if (ingresso.validade) {
    const validade = new Date(ingresso.validade).getTime();
    if (!Number.isFinite(validade) || validade <= Date.now()) return null;
  }

  return ingresso;
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

function viajantes(item: Ingresso) {
  const partes: string[] = [];
  if (item.adultos > 0) partes.push(`${item.adultos} adulto${item.adultos === 1 ? "" : "s"}`);
  if (item.criancas > 0) partes.push(`${item.criancas} criança${item.criancas === 1 ? "" : "s"}`);
  return partes.join(" + ");
}

function descricao(item: Ingresso) {
  const preco = moeda(item.preco_por_pessoa || item.preco_total, item.moeda);
  const local = item.cidade_uf ? ` • ${item.cidade_uf}` : "";
  return `🎟️ ${item.atracao_nome}${local} • ${preco}${item.preco_por_pessoa ? " por pessoa" : ""}. Oferta selecionada pelo Achados do Casal.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ingresso = await carregarIngresso(id);

  if (!ingresso) {
    return {
      title: "Ingresso indisponível | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const description = descricao(ingresso);
  const url = `https://achadosdocasal.com.br/viagens/ingresso/${ingresso.id}`;

  return {
    title: `${ingresso.titulo} | Achados do Casal`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ingresso.titulo,
      description,
      url,
      siteName: "Achados do Casal",
      type: "website",
      images: ingresso.imagem_url ? [{ url: ingresso.imagem_url, alt: ingresso.titulo }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ingresso.titulo,
      description,
      images: ingresso.imagem_url ? [ingresso.imagem_url] : undefined,
    },
  };
}

export default async function PaginaIngresso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ingresso = await carregarIngresso(id);
  if (!ingresso) notFound();

  const precoPrincipal = ingresso.preco_por_pessoa || ingresso.preco_total;
  const textoCompartilhar = descricao(ingresso);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="/viagens#ingressos-experiencias" className="font-black text-fuchsia-700">
            ← Voltar para Viagens
          </a>
          <span className="text-sm font-black uppercase tracking-wide text-slate-400">Achados do Casal</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-fuchsia-100 bg-white shadow-xl">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-h-[320px] bg-gradient-to-br from-fuchsia-100 via-violet-100 to-sky-100 lg:min-h-[620px]">
              {ingresso.imagem_url ? (
                <img src={ingresso.imagem_url} alt={ingresso.titulo} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full min-h-[320px] items-center justify-center text-8xl">🎟️</div>
              )}
            </div>

            <div className="p-6 sm:p-9">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-fuchsia-700">Ingresso / atração</span>
                {ingresso.destaque ? <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">⭐ Destaque</span> : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">Oferta parceira • {ingresso.parceiro}</span>
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">{ingresso.titulo}</h1>
              <p className="mt-3 text-lg font-bold text-slate-700">🎟️ {ingresso.atracao_nome}</p>
              {ingresso.cidade_uf ? <p className="mt-2 font-bold text-slate-500">📍 {ingresso.cidade_uf}</p> : null}

              <div className="mt-6 grid grid-cols-2 gap-3">
                {ingresso.data_uso ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <span className="text-xs font-black uppercase text-slate-400">Data de uso</span>
                    <p className="mt-1 font-black">{dataCurta(ingresso.data_uso)}</p>
                  </div>
                ) : null}
                {viajantes(ingresso) ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <span className="text-xs font-black uppercase text-slate-400">Ingresso para</span>
                    <p className="mt-1 font-black">{viajantes(ingresso)}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-7 border-t border-slate-200 pt-6">
                <p className="text-sm font-bold text-slate-500">{ingresso.preco_por_pessoa ? "por pessoa" : "preço informado"}</p>
                <p className="mt-1 text-4xl font-black text-emerald-700">{moeda(precoPrincipal, ingresso.moeda)}</p>
                {ingresso.preco_por_pessoa ? <p className="mt-1 text-sm text-slate-500">Total informado: {moeda(ingresso.preco_total, ingresso.moeda)}</p> : null}
              </div>

              <CompartilharIngresso titulo={ingresso.titulo} texto={textoCompartilhar} />

              <a
                href={ingresso.link_afiliado}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="mt-7 flex w-full items-center justify-center rounded-xl bg-fuchsia-600 px-6 py-4 text-center text-lg font-black text-white transition hover:bg-fuchsia-700"
              >
                Ver ingresso na {ingresso.parceiro} ↗
              </a>

              <p className="mt-3 text-xs leading-5 text-slate-400">Preço e disponibilidade podem mudar no parceiro. O botão acima pode conter link de afiliado; isso não altera o preço para você.</p>

              {ingresso.observacoes ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">{ingresso.observacoes}</p> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
