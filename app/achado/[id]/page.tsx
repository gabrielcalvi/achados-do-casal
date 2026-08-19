import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Oferta = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
  desconto_percentual: number | null;
  preco_original: number | null;
  preco_oferta: number | null;
  validade: string | null;
  selos: string[] | null;
  loja: { nome: string; slug: string; dominio: string | null } | null;
};

async function carregarOferta(id: string): Promise<Oferta | null> {
  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("economize_ofertas")
    .select(`
      id,
      titulo,
      descricao,
      categoria,
      imagem_url,
      desconto_percentual,
      preco_original,
      preco_oferta,
      validade,
      selos,
      loja:economize_lojas!inner (
        nome,
        slug,
        dominio,
        ativa
      )
    `)
    .eq("id", id)
    .eq("status", "ativo")
    .eq("economize_lojas.ativa", true)
    .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
    .or(`validade.is.null,validade.gt.${agora}`)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Oferta;
}

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const oferta = await carregarOferta(id);

  if (!oferta) {
    return { title: "Achado não encontrado | Achados do Casal" };
  }

  const preco = moeda(oferta.preco_oferta);
  const desconto = Number(oferta.desconto_percentual) || 0;
  const descricao = `${preco ? `${preco}` : "Oferta"}${desconto > 0 ? ` · ${Math.round(desconto)}% OFF` : ""} na ${oferta.loja?.nome || "loja"}. Confira preço e disponibilidade.`;
  const url = `https://achadosdocasal.com.br/achado/${id}`;
  const imagemSocial = oferta.imagem_url
    ? [{ url: oferta.imagem_url, width: 1500, height: 1500, alt: oferta.titulo }]
    : undefined;

  return {
    title: { absolute: `${oferta.titulo} | Achados do Casal` },
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      title: oferta.titulo,
      description: descricao,
      url,
      siteName: "Achados do Casal",
      type: "website",
      images: imagemSocial,
    },
    twitter: {
      card: "summary_large_image",
      title: oferta.titulo,
      description: descricao,
      images: oferta.imagem_url ? [oferta.imagem_url] : undefined,
    },
  };
}

export default async function AchadoPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const oferta = await carregarOferta(id);
  if (!oferta) notFound();

  const precoAtual = moeda(oferta.preco_oferta);
  const precoOriginal = moeda(oferta.preco_original);
  const desconto = Number(oferta.desconto_percentual) || 0;
  const loja = oferta.loja?.nome || "Loja parceira";

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-black">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center">
            <img src="/logo-achados-do-casal.png" alt="Achados do Casal" className="h-12 w-auto" />
          </Link>
          <Link href={oferta.loja?.slug === "nike" ? "/nike" : "/economize"} className="rounded-full border border-black px-4 py-2 text-sm font-black hover:bg-black hover:text-white">
            Ver mais achados
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <div className="grid overflow-hidden rounded-[2rem] bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative flex min-h-[420px] items-center justify-center bg-[#f7f7f7] p-8 sm:min-h-[560px]">
            {desconto > 0 ? (
              <span className="absolute left-6 top-6 rounded-full bg-black px-4 py-2 text-sm font-black text-white">-{Math.round(desconto)}%</span>
            ) : null}
            {oferta.imagem_url ? (
              <img src={oferta.imagem_url} alt={oferta.titulo} className="max-h-[500px] w-full object-contain" />
            ) : null}
          </div>

          <div className="flex flex-col p-7 sm:p-10 lg:p-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Achado do Casal · {loja}</p>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{oferta.titulo}</h1>
            {oferta.categoria ? <p className="mt-3 text-sm font-bold text-zinc-500">{oferta.categoria}</p> : null}

            <div className="mt-8 border-y border-black/10 py-6">
              {precoOriginal && oferta.preco_original && oferta.preco_oferta && Number(oferta.preco_original) > Number(oferta.preco_oferta) ? (
                <p className="text-base text-zinc-400 line-through">De {precoOriginal}</p>
              ) : null}
              <p className="mt-1 text-4xl font-black">{precoAtual || "Ver condição"}</p>
              {desconto > 0 ? <p className="mt-2 font-black text-zinc-600">Economize {Math.round(desconto)}%</p> : null}
            </div>

            {oferta.descricao ? (
              <p className="mt-6 line-clamp-6 leading-7 text-zinc-600">{oferta.descricao}</p>
            ) : null}

            <div className="mt-auto pt-8">
              <Link href={`/oferta/${oferta.id}?origem=site`} className="flex h-14 w-full items-center justify-center rounded-full bg-black px-6 text-lg font-black text-white transition hover:bg-zinc-800">
                Ver oferta na {loja}
              </Link>
              <p className="mt-3 text-center text-[11px] leading-5 text-zinc-400">Link de afiliado do Achados do Casal. Preço e disponibilidade podem mudar na loja.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-black p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Pode compartilhar</p>
          <p className="mt-2 max-w-3xl leading-7 text-zinc-300">Este é o link individual deste achado. Ao enviar esta página no WhatsApp ou Telegram, o destino continua sendo o Achados do Casal e o botão de compra preserva o rastreamento do afiliado.</p>
        </div>
      </section>
    </main>
  );
}
