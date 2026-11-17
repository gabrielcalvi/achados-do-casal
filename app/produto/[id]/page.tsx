import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatarTempoDeUso } from "@/lib/reviews/tempoUso";
import ProdutoGaleria from "./ProdutoGaleria";
import ProdutoCompartilhar from "./ProdutoCompartilhar";
import ProdutoAcoesLocais from "@/components/ProdutoAcoesLocais";
import AlertaPrecoInteresse from "@/components/AlertaPrecoInteresse";
import QueroReviewButton from "@/components/QueroReviewButton";

export const dynamic = "force-dynamic";

const BASE_URL = "https://achadosdocasal.com.br";

type Produto = {
  id: number;
  nome: string;
  descricao: string | null;
  loja: string;
  categoria: string;
  imagem: string;
  preco_antigo: number | null;
  preco_atual: number | null;
  avaliacao: number | null;
  vendas: string | null;
  parcelas: string | null;
  frete_gratis: boolean | null;
  ativo: boolean | null;
  tem_em_casa: boolean | null;
  opiniao_casal: string | null;
  nota_casal: number | null;
  tempo_de_uso: string | null;
  data_inicio_uso: string | null;
  pontos_positivos: string | null;
  pontos_negativos: string | null;
  review_completa: boolean | null;
  video_url: string | null;
  updated_at: string | null;
  monitoramento_manual: boolean | null;
  preco_manual_atualizado_em: string | null;
  review_link_compra: string | null;
  compartilhamento_titulo: string | null;
  compartilhamento_descricao: string | null;
};

type ImagemExtra = {
  id: number;
  url: string;
};

type ReviewRelacionada = {
  id: number;
  nome: string;
  imagem: string;
  nota_casal: number | null;
};

type ReviewAtualizacao = {
  id: number;
  data_referencia: string;
  titulo: string;
  texto: string;
  nota: number | null;
  tempo_de_uso: string | null;
};

async function carregarProduto(id: string) {
  const [{ data: produto, error }, { data: imagens }, { data: atualizacoes }] = await Promise.all([
    supabaseAdmin.from("produtos").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("produto_imagens")
      .select("id,url")
      .eq("produto_id", id)
      .order("ordem", { ascending: true }),
    supabaseAdmin
      .from("review_atualizacoes")
      .select("id,data_referencia,titulo,texto,nota,tempo_de_uso")
      .eq("produto_id", id)
      .eq("visivel", true)
      .order("data_referencia", { ascending: false }),
  ]);

  if (error || !produto) return null;

  let relacionadas: ReviewRelacionada[] = [];
  if (produto.review_completa) {
    let query = supabaseAdmin
      .from("produtos")
      .select("id,nome,imagem,nota_casal")
      .eq("review_completa", true)
      .neq("id", produto.id)
      .order("id", { ascending: false })
      .limit(3);

    if (produto.categoria) query = query.eq("categoria", produto.categoria);

    const { data } = await query;
    relacionadas = (data || []) as ReviewRelacionada[];

    if (!relacionadas.length) {
      const { data: fallback } = await supabaseAdmin
        .from("produtos")
        .select("id,nome,imagem,nota_casal")
        .eq("review_completa", true)
        .neq("id", produto.id)
        .order("id", { ascending: false })
        .limit(3);
      relacionadas = (fallback || []) as ReviewRelacionada[];
    }
  }

  return {
    produto: produto as Produto,
    imagens: (imagens || []) as ImagemExtra[],
    atualizacoes: (atualizacoes || []) as ReviewAtualizacao[],
    relacionadas,
  };
}

function textoLimpo(valor: string | null | undefined, limite = 155) {
  const limpo = String(valor || "").replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite - 3).trimEnd()}...`;
}

function moeda(valor: number | null | undefined) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const dados = await carregarProduto(id);

  if (!dados) {
    return {
      title: "Produto não encontrado | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const { produto } = dados;
  const url = `${BASE_URL}/produto/${produto.id}`;
  const preco = produto.ativo ? moeda(produto.preco_atual) : null;
  const precoAntigo =
    produto.ativo &&
    produto.preco_antigo &&
    Number(produto.preco_antigo) > Number(produto.preco_atual)
      ? moeda(produto.preco_antigo)
      : null;
  const tituloAutomatico = produto.review_completa
    ? `${produto.nome}: review do casal`
    : preco
      ? `🔥 ${preco} • ${produto.nome}`
      : `${produto.nome}: preço e oferta`;

  const baseDescricao =
    produto.review_completa && produto.opiniao_casal
      ? produto.opiniao_casal
      : produto.descricao;

  const descricaoAutomatica =
    produto.ativo && preco
      ? `${precoAntigo ? `De ${precoAntigo} por ${preco}. ` : `${preco}. `}${produto.loja} • Oferta encontrada pelo Achados do Casal. Confira preço e disponibilidade.`
      : textoLimpo(baseDescricao) ||
        `${produto.nome} na ${produto.loja}. Confira detalhes no Achados do Casal.`;

  const titulo = produto.compartilhamento_titulo?.trim() || tituloAutomatico;
  const description =
    produto.compartilhamento_descricao?.trim() || descricaoAutomatica;

  return {
    title: { absolute: `${titulo} | Achados do Casal` },
    description,
    alternates: { canonical: url },
    robots:
      produto.ativo || produto.review_completa
        ? { index: true, follow: true }
        : { index: false, follow: true },
    openGraph: {
      title: `${titulo} | Achados do Casal`,
      description,
      url,
      siteName: "Achados do Casal",
      type: "website",
      images: produto.imagem
        ? [{ url: produto.imagem, alt: produto.nome }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${titulo} | Achados do Casal`,
      description,
      images: produto.imagem ? [produto.imagem] : undefined,
    },
  };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dados = await carregarProduto(id);
  if (!dados) notFound();

  const { produto, imagens, atualizacoes, relacionadas } = dados;
  const url = `${BASE_URL}/produto/${produto.id}`;
  const precoAtual = Number(produto.preco_atual);
  const temPrecoAtivo = Boolean(produto.ativo && Number.isFinite(precoAtual) && precoAtual > 0);
  const notaCasal = Number(produto.nota_casal);

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    url,
    image: [produto.imagem, ...imagens.map((imagem) => imagem.url)].filter(Boolean),
    description:
      textoLimpo(
        produto.review_completa ? produto.opiniao_casal || produto.descricao : produto.descricao,
        500,
      ) || undefined,
    category: produto.categoria || undefined,
  };

  if (temPrecoAtivo) {
    productJsonLd.offers = {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: precoAtual.toFixed(2),
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: produto.loja || "Loja parceira",
      },
    };
  }

  if (produto.review_completa && Number.isFinite(notaCasal) && notaCasal > 0) {
    productJsonLd.review = {
      "@type": "Review",
      author: {
        "@type": "Organization",
        name: "Achados do Casal",
      },
      reviewBody: textoLimpo(produto.opiniao_casal, 1000) || undefined,
      reviewRating: {
        "@type": "Rating",
        ratingValue: notaCasal,
        bestRating: 10,
        worstRating: 1,
      },
    };
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: BASE_URL,
      },
      ...(produto.review_completa
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: "Reviews do Casal",
              item: `${BASE_URL}/reviews`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: produto.nome,
              item: url,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: produto.nome,
              item: url,
            },
          ]),
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 pb-28 lg:pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500">
        <Link href="/" className="hover:text-blue-950">Início</Link>
        <span aria-hidden="true">›</span>
        {produto.review_completa ? (
          <>
            <Link href="/reviews" className="hover:text-blue-950">Reviews do Casal</Link>
            <span aria-hidden="true">›</span>
          </>
        ) : null}
        <span className="max-w-full truncate text-slate-700">{produto.nome}</span>
      </nav>

      <Link
        href={produto.review_completa ? "/reviews" : "/"}
        className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm transition hover:border-blue-950 hover:text-blue-950"
      >
        ← {produto.review_completa ? "Voltar para Reviews do Casal" : "Voltar para os produtos"}
      </Link>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProdutoGaleria
          nome={produto.nome}
          imagemPrincipal={produto.imagem}
          imagensExtras={imagens}
        />

        <div>
          <p className="text-sm font-black uppercase text-blue-800">{produto.loja}</p>
          <h1 className="mt-3 text-4xl font-black text-slate-950">{produto.nome}</h1>

          {produto.tem_em_casa ? (
            <span className="mt-4 inline-flex rounded-full bg-pink-100 px-4 py-2 text-sm font-bold text-pink-700">
              ❤️ O Casal tem em casa
            </span>
          ) : null}

          {produto.ativo ? (
            <div className="mt-6">
              {produto.preco_antigo &&
              Number(produto.preco_antigo) > Number(produto.preco_atual) ? (
                <p className="text-sm text-slate-400 line-through">
                  De {Number(produto.preco_antigo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              ) : null}

              <p className="mt-1 text-3xl font-black text-pink-600">
                {Number(produto.preco_atual).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>

              {produto.avaliacao || produto.vendas ? (
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-slate-700">
                  {produto.avaliacao ? <span>⭐ {produto.avaliacao}</span> : null}
                  {produto.vendas ? <span>🛒 {produto.vendas}</span> : null}
                </div>
              ) : null}

              {produto.parcelas || produto.frete_gratis ? (
                <div className="mt-4 space-y-2">
                  {produto.parcelas ? <p className="font-bold text-slate-700">💳 {produto.parcelas}</p> : null}
                  {produto.frete_gratis ? <p className="font-bold text-green-700">🚚 Frete grátis</p> : null}
                </div>
              ) : null}

              {produto.tem_em_casa || produto.review_completa ? (
                <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                    Experiência do Achados
                  </p>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
                    {produto.tem_em_casa ? <p>🏠 Temos este produto em casa</p> : null}
                    {Number.isFinite(notaCasal) && notaCasal > 0 ? (
                      <p>⭐ Nossa nota: {notaCasal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/10</p>
                    ) : null}
                    {produto.data_inicio_uso || produto.tempo_de_uso ? (
                      <p>📅 Usamos há {formatarTempoDeUso(produto.data_inicio_uso, produto.tempo_de_uso)}</p>
                    ) : null}
                    {produto.video_url ? <p>🎥 Review em vídeo disponível</p> : null}
                  </div>
                </div>
              ) : null}

              {produto.updated_at ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {produto.monitoramento_manual ? "🖐️ Preço atualizado manualmente em " : "✅ Preço atualizado em "}
                  {new Date(produto.preco_manual_atualizado_em || produto.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às{" "}
                  {new Date(produto.preco_manual_atualizado_em || produto.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                </p>
              ) : null}

              <a
                href={`/produto/${produto.id}/ir?origem=site`}
                className="mt-8 inline-flex w-full justify-center rounded-xl bg-blue-950 px-6 py-4 font-black text-white hover:bg-blue-900"
              >
                Ver oferta
              </a>

              <ProdutoAcoesLocais produtoId={produto.id} />

              <AlertaPrecoInteresse produtoId={produto.id} precoAtual={precoAtual} />

              {!produto.review_completa ? <QueroReviewButton produtoId={produto.id} /> : null}

              <ProdutoCompartilhar
                titulo={
                  produto.compartilhamento_titulo?.trim() ||
                  (temPrecoAtivo
                    ? `🔥 ${moeda(produto.preco_atual)} • ${produto.nome}`
                    : produto.nome)
                }
                descricao={
                  produto.compartilhamento_descricao?.trim() ||
                  (temPrecoAtivo
                    ? `${produto.preco_antigo && Number(produto.preco_antigo) > Number(produto.preco_atual) ? `De ${moeda(produto.preco_antigo)} por ${moeda(produto.preco_atual)}. ` : `${moeda(produto.preco_atual)}. `}${produto.loja} • Oferta encontrada pelo Achados do Casal. Confira preço e disponibilidade.`
                    : `Confira este achado no Achados do Casal.`)
                }
                url={url}
              />
            </div>
          ) : produto.review_completa ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-black text-amber-900">⭐ Review publicada · oferta não monitorada</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Mantemos esta página pela nossa experiência real com o produto. O preço e o link de compra antigos não estão sendo exibidos porque a oferta não está ativa no Achados.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {produto.tem_em_casa ? (
        <section className="mt-12 rounded-3xl border border-pink-200 bg-pink-50 p-8">
          <h2 className="text-3xl font-black text-pink-700">❤️ Avaliação do Casal</h2>

          {produto.video_url ? (
            <div className="mt-6">
              <h3 className="mb-4 text-xl font-bold text-black">🎥 Veja o produto em uso</h3>
              <div className="overflow-hidden rounded-2xl">
                <iframe
                  className="aspect-video w-full"
                  src={produto.video_url
                    .replace("watch?v=", "embed/")
                    .replace("youtu.be/", "www.youtube.com/embed/")
                    .replace("youtube.com/shorts/", "www.youtube.com/embed/")}
                  title={`Vídeo da análise de ${produto.nome}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {produto.nota_casal ? (
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm text-slate-500">Nota do casal</p>
                <p className="mt-1 text-3xl font-black">⭐ {produto.nota_casal}/10</p>
              </div>
            ) : null}
            {produto.data_inicio_uso || produto.tempo_de_uso ? (
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm text-slate-500">Tempo de uso</p>
                <p className="mt-1 text-xl font-black">
                  {formatarTempoDeUso(produto.data_inicio_uso, produto.tempo_de_uso)}
                </p>
              </div>
            ) : null}
          </div>

          {produto.opiniao_casal ? (
            <div className="mt-6 rounded-2xl bg-white p-6">
              <h3 className="text-xl font-black">Nossa opinião</h3>
              <p className="mt-3 whitespace-pre-line text-slate-700">{produto.opiniao_casal}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {produto.pontos_positivos ? (
              <div className="rounded-2xl bg-white p-6">
                <h3 className="text-xl font-black text-green-700">👍 Pontos positivos</h3>
                <ul className="mt-3 space-y-2">
                  {produto.pontos_positivos.split("\n").filter(Boolean).map((item, index) => (
                    <li key={index}>✅ {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {produto.pontos_negativos ? (
              <div className="rounded-2xl bg-white p-6">
                <h3 className="text-xl font-black text-red-700">👎 Pontos negativos</h3>
                <ul className="mt-3 space-y-2">
                  {produto.pontos_negativos.split("\n").filter(Boolean).map((item, index) => (
                    <li key={index}>⚠️ {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {atualizacoes.length > 0 ? (
            <div className="mt-8 rounded-2xl bg-white p-6">
              <h3 className="text-xl font-black">📈 Evolução do nosso review</h3>
              <p className="mt-1 text-sm text-slate-500">
                Atualizações ao longo do tempo, sem apagar o que pensamos antes.
              </p>
              <div className="mt-5 space-y-4 border-l-2 border-amber-200 pl-5">
                {atualizacoes.map((item) => (
                  <article key={item.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-amber-400 ring-4 ring-white" />
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {new Date(item.data_referencia + "T12:00:00Z").toLocaleDateString("pt-BR")}
                      {item.tempo_de_uso ? ` · ${item.tempo_de_uso}` : ""}
                    </p>
                    <h4 className="mt-1 text-lg font-black">{item.titulo}</h4>
                    {item.nota !== null ? (
                      <p className="mt-1 font-black text-amber-700">
                        ⭐ {Number(item.nota).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/10
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-line text-slate-700">{item.texto}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {produto.review_completa && produto.review_link_compra ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-lg font-black text-emerald-900">Gostou do produto?</p>
              <p className="mt-1 text-sm text-emerald-800">
                Acesse pelo nosso link afiliado para conferir a oferta atual.
              </p>
              <a
                href={`/produto/${produto.id}/review-ir?origem=site`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-4 font-black text-white transition hover:bg-emerald-700"
              >
                Gostou do produto? Clique aqui e compre →
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {temPrecoAtivo ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500">Oferta atual</p>
              <p className="truncate text-lg font-black text-pink-600">
                {Number(produto.preco_atual).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
            <a
              href={`/produto/${produto.id}/ir?origem=barra_fixa`}
              className="shrink-0 rounded-xl bg-blue-950 px-5 py-3 text-sm font-black text-white"
            >
              Ver oferta
            </a>
          </div>
        </div>
      ) : null}

      {produto.review_completa ? (
        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-amber-700">Conteúdo original</p>
              <h2 className="mt-1 text-2xl font-black">Mais Reviews do Casal</h2>
            </div>
            <Link href="/reviews" className="font-black text-blue-950 hover:text-blue-800">
              Ver todas as reviews →
            </Link>
          </div>

          {relacionadas.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {relacionadas.map((item) => (
                <Link
                  key={item.id}
                  href={`/produto/${item.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <img src={item.imagem} alt={item.nome} className="h-20 w-20 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-black">{item.nome}</p>
                    {item.nota_casal ? <p className="mt-1 text-sm font-bold text-amber-700">⭐ {item.nota_casal}/10</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
