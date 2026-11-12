import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews do Casal | Achados do Casal",
  description:
    "Avaliações reais de produtos que usamos em casa, com nota do casal, tempo de uso, pontos positivos, pontos negativos e vídeo quando disponível.",
  alternates: {
    canonical: "https://achadosdocasal.com.br/reviews",
  },
  openGraph: {
    title: "Reviews do Casal | Achados do Casal",
    description: "Produtos que realmente usamos e avaliamos em casa.",
    url: "https://achadosdocasal.com.br/reviews",
    type: "website",
  },
};

function nota(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : null;
}

export default async function ReviewsPage() {
  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,loja,categoria,imagem,nota_casal,tempo_de_uso,video_url,tem_em_casa,review_completa,ativo,preco_atual,preco_antigo,monitoramento_manual,updated_at")
    .eq("review_completa", true)
    .order("id", { ascending: false });

  const reviews = produtos || [];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <Link href="/" className="text-sm font-black text-slate-800 hover:text-black">
            ← Voltar para os achados
          </Link>

          <span className="mt-8 inline-flex rounded-full bg-white/70 px-4 py-2 text-sm font-black uppercase tracking-wide">
            ⭐ Produtos que realmente usamos
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
            Reviews do Casal
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-800">
            Nossa experiência real com produtos que temos ou tivemos em casa.
            A review continua publicada mesmo quando a oferta original deixa de ser monitorada.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        {error ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            <h2 className="text-xl font-black">Não foi possível carregar os reviews.</h2>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-2xl font-black">Novos reviews em breve</h2>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-black">
                {reviews.length} review{reviews.length === 1 ? "" : "s"} publicada{reviews.length === 1 ? "" : "s"}
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((produto) => {
                const notaCasal = nota(produto.nota_casal);

                return (
                  <article
                    key={produto.id}
                    className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <Link
                      href={`/produto/${produto.id}`}
                      className="relative flex h-64 items-center justify-center bg-slate-50 p-6"
                    >
                      {produto.video_url ? (
                        <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white">
                          🎥 COM VÍDEO
                        </span>
                      ) : null}

                      <img
                        src={produto.imagem}
                        alt={produto.nome}
                        className="h-full w-full max-w-[250px] object-contain"
                      />
                    </Link>

                    <div className="flex flex-1 flex-col p-6">
                      <p className="text-xs font-black uppercase text-blue-800">
                        {produto.loja}
                      </p>

                      <h2 className="mt-2 min-h-[84px] line-clamp-3 text-xl font-black leading-7">
                        {produto.nome}
                      </h2>

                      <div className="mt-5 grid min-h-[84px] grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <p className="text-xs font-bold text-slate-500">Nota do casal</p>
                          <p className="mt-1 text-2xl font-black">
                            {notaCasal ? `⭐ ${notaCasal}/10` : "—"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500">Tempo de uso</p>
                          <p className="mt-1 font-black">
                            {produto.tempo_de_uso || "Não informado"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 min-h-[108px]">
                        {produto.ativo && Number(produto.preco_atual) > 0 ? (
                          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                            <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                              🔥 Oferta atual
                            </p>

                            {produto.preco_antigo &&
                              Number(produto.preco_antigo) > Number(produto.preco_atual) && (
                                <p className="mt-1 text-xs font-semibold text-slate-500 line-through">
                                  De {Number(produto.preco_antigo).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </p>
                              )}

                            <p className="mt-1 text-2xl font-black text-orange-600">
                              {Number(produto.preco_atual).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-orange-800">
                              {produto.monitoramento_manual
                                ? `🖐️ Preço atualizado em ${new Date(produto.updated_at).toLocaleDateString("pt-BR")} às ${new Date(produto.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                : "✅ Preço monitorado pelo Achados"}
                            </p>
                          </div>
                        ) : (
                          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                            Review ativa · oferta atual não monitorada.
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/produto/${produto.id}`}
                        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-950 px-5 font-black text-white transition hover:bg-blue-900"
                      >
                        🔎 Ver review completa
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
