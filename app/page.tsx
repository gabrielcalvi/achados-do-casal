"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarTempoDeUso } from "@/lib/reviews/tempoUso";
import HeroDestaque from "@/components/HeroDestaque";
import CardProduto from "@/components/CardProduto";

type Produto = {
  id: number;
  nome: string;
  loja: string;
  categoria: string;
  imagem: string;
  precoAnterior?: number;
  precoAtual: number;
  pagamento: string;
  link: string;
  link_afiliado?: string | null;
  selo?: string;
  avaliacao?: number;
  vendas?: string;
  parcelas?: string;
  freteGratis: boolean;
  destaque: boolean;
  temEmCasa?: boolean;
  reviewCompleta?: boolean;
};

type OfertaAwin = {
  id: string;
  titulo: string;
  categoria: string | null;
  imagem: string;
  precoAnterior: number | null;
  precoAtual: number;
  desconto: number | null;
  loja: string;
};

type ReviewHome = {
  id: number;
  nome: string;
  loja: string;
  imagem: string;
  nota_casal: number | null;
  tempo_de_uso: string | null;
  data_inicio_uso: string | null;
  video_url: string | null;
  tem_em_casa: boolean | null;
  ativo: boolean | null;
  preco_atual: number | null;
  preco_antigo: number | null;
};

const categorias = [
  "Todos",
  "Tecnologia",
  "Celulares",
  "Casa e Cozinha",
  "Automotivo",
  "Esportes",
  "Saúde e Bem-estar",
  "Alimentos e Bebidas",
  "Ferramentas",
  "Moda",
  "Brinquedos",
  "Infantil",
  "Pet",
];

function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function mapearProduto(p: Record<string, any>): Produto {
  return {
    id: p.id,
    nome: p.nome,
    loja: p.loja,
    categoria: p.categoria,
    imagem: p.imagem,
    precoAnterior: p.preco_antigo,
    precoAtual: p.preco_atual,
    pagamento: p.cupom || "",
    link: p.link_afiliado || p.link,
    link_afiliado: p.link_afiliado,
    selo: p.destaque ? "Oferta" : "",
    avaliacao: p.avaliacao,
    vendas: p.vendas,
    parcelas: p.parcelas,
    freteGratis: p.frete_gratis,
    destaque: Boolean(p.destaque),
    temEmCasa: p.tem_em_casa ?? false,
    reviewCompleta: p.review_completa ?? false,
  };
}

export default function Home() {
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosDestaque, setProdutosDestaque] = useState<Produto[]>([]);
  const [carregandoDestaques, setCarregandoDestaques] = useState(true);
  const [ofertasAwin, setOfertasAwin] = useState<OfertaAwin[]>([]);
  const [reviewsRecentes, setReviewsRecentes] = useState<ReviewHome[]>([]);

  useEffect(() => {
    async function carregarProdutos() {
      setCarregandoDestaques(true);

      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error(error);
        setProdutos([]);
        setProdutosDestaque([]);
        setCarregandoDestaques(false);
        return;
      }

      const produtosMapeados = (data || []).map(mapearProduto);

      setProdutos(produtosMapeados);
      setProdutosDestaque(
        produtosMapeados.filter(
          (produto) =>
            produto.destaque &&
            Boolean(produto.imagem) &&
            Number(produto.precoAtual) > 0,
        ),
      );
      setCarregandoDestaques(false);
    }

    async function carregarReviews() {
      const { data, error } = await supabase
        .from("produtos")
        .select("id,nome,loja,imagem,nota_casal,tempo_de_uso,data_inicio_uso,video_url,tem_em_casa,ativo,preco_atual,preco_antigo")
        .eq("review_completa", true)
        .order("id", { ascending: false })
        .limit(3);

      if (error) {
        console.error("Falha ao carregar reviews na home:", error);
        setReviewsRecentes([]);
        return;
      }

      setReviewsRecentes((data || []) as ReviewHome[]);
    }

    async function carregarSelecaoAwin() {
      const agora = new Date().toISOString();
      const { data: ofertas, error } = await supabase
        .from("economize_ofertas")
        .select(
          "id,titulo,categoria,imagem_url,preco_original,preco_oferta,desconto_percentual,loja_id",
        )
        .eq("status", "ativo")
        .or("origem.like.agente_produtos_awin_%,origem.eq.agente_produtos_terabyte")
        .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
        .or(`validade.is.null,validade.gt.${agora}`)
        .not("link_afiliado", "is", null)
        .not("imagem_url", "is", null)
        .not("preco_oferta", "is", null)
        .order("desconto_percentual", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(120);

      if (error || !ofertas?.length) {
        if (error) console.error("Falha ao carregar seleção AWIN:", error);
        setOfertasAwin([]);
        return;
      }

      const lojaIds = Array.from(
        new Set(ofertas.map((oferta) => oferta.loja_id).filter(Boolean)),
      );
      const { data: lojas } = lojaIds.length
        ? await supabase
            .from("economize_lojas")
            .select("id,nome,segmento")
            .in("id", lojaIds)
        : { data: [] };
      const lojasPorId = new Map(
        (lojas || []).map((loja) => [
          String(loja.id),
          {
            nome: loja.nome,
            segmento: loja.segmento || "varejo",
          },
        ]),
      );
      const porLoja = new Map<string, number>();
      const selecionadas: OfertaAwin[] = [];

      for (const oferta of ofertas) {
        const lojaId = String(oferta.loja_id || "awin");
        const loja = lojasPorId.get(lojaId);
        if (loja?.segmento === "viagens") continue;

        const quantidade = porLoja.get(lojaId) || 0;
        if (quantidade >= 3) continue;

        const precoAtual = Number(oferta.preco_oferta);
        const precoAnterior = oferta.preco_original
          ? Number(oferta.preco_original)
          : null;
        if (!Number.isFinite(precoAtual) || precoAtual <= 0) continue;

        selecionadas.push({
          id: String(oferta.id),
          titulo: oferta.titulo,
          categoria: oferta.categoria || null,
          imagem: oferta.imagem_url,
          precoAnterior:
            precoAnterior && Number.isFinite(precoAnterior)
              ? precoAnterior
              : null,
          precoAtual,
          desconto: oferta.desconto_percentual
            ? Number(oferta.desconto_percentual)
            : null,
          loja: loja?.nome || "Parceiro AWIN",
        });
        porLoja.set(lojaId, quantidade + 1);
      }

      setOfertasAwin(selecionadas);
    }

    carregarProdutos();
    carregarReviews();
    carregarSelecaoAwin();
  }, []);

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    const reviewsNoTopo = new Set(reviewsRecentes.map((review) => review.id));

    return produtos.filter(
      (produto) =>
        !reviewsNoTopo.has(produto.id) &&
        (categoriaAtiva === "Todos" ||
          produto.categoria === categoriaAtiva) &&
        (!termo ||
          produto.nome.toLowerCase().includes(termo) ||
          produto.loja.toLowerCase().includes(termo) ||
          produto.categoria.toLowerCase().includes(termo)),
    );
  }, [pesquisa, categoriaAtiva, produtos, reviewsRecentes]);

  const mostrarSelecaoAwin =
    categoriaAtiva === "Todos" &&
    pesquisa.trim() === "" &&
    ofertasAwin.length > 0;

  function irParaResultados() {
    document.getElementById("ofertas")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="relative z-50 border-b border-slate-200 bg-white shadow-sm lg:sticky lg:top-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
          <a href="/" className="shrink-0">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-16 w-auto object-contain"
            />
          </a>

          <form
            className="flex min-w-0 flex-1 gap-2 xl:max-w-2xl"
            onSubmit={(evento) => {
              evento.preventDefault();
              irParaResultados();
            }}
          >
            <input
              type="search"
              value={pesquisa}
              onChange={(evento) => setPesquisa(evento.target.value)}
              placeholder="Pesquisar produtos, categorias ou lojas..."
              className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none transition focus:border-blue-900 focus:bg-white"
            />
            <button
              type="submit"
              className="hidden rounded-xl bg-blue-950 px-6 font-bold text-white hover:bg-blue-900 sm:block"
            >
              Buscar
            </button>
          </form>

          <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
            <a
              href="#ofertas"
              className="inline-flex h-12 w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-blue-950 px-3 text-sm font-black text-white transition hover:bg-blue-900"
            >
              🔥 Ofertas
            </a>
            <Link
              href="/reviews"
              className="inline-flex h-12 w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-amber-400 px-3 text-sm font-black text-slate-950 transition hover:bg-amber-300"
            >
              ⭐ Reviews
            </Link>
            <Link
              href="/cupons"
              className="inline-flex h-12 w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              💰 Cupons
            </Link>
            <Link
              href="/viagens"
              className="inline-flex h-12 w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-sky-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
            >
              ✈️ Viagens
            </Link>
            <Link
              href="/gamer"
              className="inline-flex h-12 w-[108px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-red-600"
            >
              🎮 Gamer
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categorias.map((categoria) => (
              <button
                key={categoria}
                type="button"
                onClick={() => setCategoriaAtiva(categoria)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                  categoriaAtiva === categoria
                    ? "bg-blue-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-pink-400 hover:text-pink-500"
                }`}
              >
                {categoria}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50">
            <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-5 py-2 text-xs font-bold text-slate-500">
              <Link href="/economize" className="whitespace-nowrap hover:text-emerald-700">Central Economize</Link>
              <a href="https://www.instagram.com/achadosdocasal26/" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap hover:text-pink-600">Instagram</a>
              <Link href="/favoritos" className="whitespace-nowrap hover:text-pink-600">❤️ Favoritos</Link>
              <Link href="/comparar" className="whitespace-nowrap hover:text-blue-900">⚖️ Comparar</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="border-y-4 border-yellow-400 bg-black text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:py-8">
          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-yellow-400 sm:text-base">
              🖤 BLACK FRIDAY 2026
            </p>
            <p className="mt-2 text-xl font-black leading-tight sm:text-2xl">
              Central de cupons verificados — parceiros e marcas monitoradas
              pelo nosso radar.
            </p>
            <p className="mt-2 text-sm font-bold text-zinc-300 sm:text-base">
              Cupons reais, revalidados automaticamente e com marcas não
              parceiras quando a oferta vale a pena.
            </p>
          </div>

          <Link
            href="/cupons"
            className="inline-flex w-fit shrink-0 items-center justify-center rounded-2xl bg-yellow-400 px-8 py-4 text-base font-black uppercase tracking-wide text-black shadow-lg transition hover:-translate-y-0.5 hover:bg-yellow-300 sm:px-10 sm:py-5 sm:text-lg"
          >
            Ver cupons →
          </Link>
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-950 to-blue-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
              🔥 Ofertas selecionadas diariamente
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Achados que realmente valem a pena.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
              Produtos variados, preços interessantes e ofertas selecionadas
              nas maiores lojas do Brasil.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#ofertas"
                className="rounded-xl bg-pink-500 px-6 py-4 font-black text-white hover:bg-pink-600"
              >
                Ver ofertas
              </a>
              <Link
                href="/reviews"
                className="rounded-xl border border-white/40 px-6 py-4 font-black text-white hover:bg-white/10"
              >
                ⭐ Ver reviews
              </Link>
            </div>
          </div>

          <HeroDestaque
            produtos={produtosDestaque}
            carregando={carregandoDestaques}
          />
        </div>
      </section>

      {reviewsRecentes.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-14">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800">
                ⭐ Testados por nós
              </span>
              <h2 className="mt-3 text-3xl font-black">
                Produtos que realmente usamos
              </h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                Nossa experiência real: nota do casal, tempo de uso, pontos positivos, negativos e vídeo quando disponível.
              </p>
            </div>
            <Link href="/reviews" className="text-sm font-black text-amber-700 hover:text-amber-800">
              Ver todos os reviews →
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviewsRecentes.map((review) => (
              <article
                key={review.id}
                className="flex overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <Link
                  href={`/produto/${review.id}`}
                  className="flex w-32 shrink-0 items-center justify-center bg-amber-50 p-4 sm:w-40"
                >
                  <img src={review.imagem} alt={review.nome} className="max-h-36 w-full object-contain" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-2">
                    {review.tem_em_casa ? (
                      <span className="rounded-full bg-pink-100 px-2.5 py-1 text-[11px] font-black text-pink-700">
                        🏠 Temos em casa
                      </span>
                    ) : null}
                    {review.video_url ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
                        🎥 Com vídeo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs font-black uppercase text-blue-800">{review.loja}</p>
                  <h3 className="mt-1 line-clamp-2 text-lg font-black leading-6">{review.nome}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-xs font-bold text-slate-500">Nossa nota</p>
                      <p className="mt-1 font-black">
                        {review.nota_casal ? `⭐ ${Number(review.nota_casal).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/10` : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">Tempo de uso</p>
                      <p className="mt-1 font-black">
                        {formatarTempoDeUso(review.data_inicio_uso, review.tempo_de_uso)}
                      </p>
                    </div>
                  </div>
                  {review.ativo && Number(review.preco_atual) > 0 ? (
                    <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                        Oferta atual
                      </p>
                      {review.preco_antigo &&
                      Number(review.preco_antigo) > Number(review.preco_atual) ? (
                        <p className="mt-1 text-xs text-slate-400 line-through">
                          De {formatarPreco(Number(review.preco_antigo))}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xl font-black text-emerald-700">
                        {formatarPreco(Number(review.preco_atual))}
                      </p>
                    </div>
                  ) : null}

                  <div className={`mt-4 grid gap-2 ${review.ativo && Number(review.preco_atual) > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                    <Link
                      href={`/produto/${review.id}`}
                      className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-blue-950 bg-white px-3 text-center text-sm font-black text-blue-950 transition hover:bg-slate-50"
                    >
                      🔎 Ver review
                    </Link>
                    {review.ativo && Number(review.preco_atual) > 0 ? (
                      <a
                        href={`/produto/${review.id}/ir?origem=home_review`}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-950 px-3 text-center text-sm font-black text-white transition hover:bg-blue-900"
                      >
                        🛒 Ver oferta
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="ofertas" className="mx-auto max-w-7xl px-5 py-14">
        {mostrarSelecaoAwin && (
          <div className="mb-14">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">
                  Seleção automática + filtro do Achados
                </span>
                <h2 className="mt-3 text-3xl font-black">
                  Achados dos nossos parceiros
                </h2>
                <p className="mt-2 max-w-3xl text-slate-600">
                  Poucos produtos escolhidos entre os catálogos dos parceiros,
                  priorizando preço, desconto real e diversidade de lojas.
                </p>
              </div>
              <Link
                href="/economize"
                className="text-sm font-black text-emerald-700 hover:text-emerald-800"
              >
                Ver Central Economize →
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ofertasAwin.map((oferta) => (
                <article
                  key={oferta.id}
                  className="flex min-h-[430px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <Link
                    href={`/achado/${oferta.id}`}
                    className="relative flex min-h-[210px] items-center justify-center bg-slate-50 p-5"
                  >
                    {oferta.desconto && oferta.desconto > 0 ? (
                      <span className="absolute right-4 top-4 rounded-full bg-green-600 px-3 py-2 text-xs font-black text-white">
                        -{Math.round(oferta.desconto)}%
                      </span>
                    ) : null}
                    <img
                      src={oferta.imagem}
                      alt={oferta.titulo}
                      className="h-[180px] w-full max-w-[230px] object-contain"
                    />
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-black uppercase text-blue-800">
                      {oferta.loja}
                    </p>
                    <h3 className="mt-2 line-clamp-3 text-lg font-black leading-6">
                      {oferta.titulo}
                    </h3>
                    {oferta.categoria && (
                      <p className="mt-2 text-sm text-slate-500">
                        {oferta.categoria}
                      </p>
                    )}

                    <div className="mt-auto pt-5">
                      {oferta.precoAnterior &&
                      oferta.precoAnterior > oferta.precoAtual ? (
                        <p className="text-sm text-slate-400 line-through">
                          De {formatarPreco(oferta.precoAnterior)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-3xl font-black text-pink-500">
                        {formatarPreco(oferta.precoAtual)}
                      </p>
                      <Link
                        href={`/achado/${oferta.id}`}
                        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-950 px-5 font-black text-white transition hover:bg-blue-900"
                      >
                        🛒 Ver produto
                      </Link>
                      <p className="mt-2 text-center text-[11px] text-slate-400">
                        Página do Achados. Preço e disponibilidade podem mudar.
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-black">Últimos achados</h2>
            <p className="mt-2 text-slate-600">
              {produtosFiltrados.length} produto
              {produtosFiltrados.length === 1 ? "" : "s"} encontrado
              {produtosFiltrados.length === 1 ? "" : "s"}.
            </p>
          </div>
          {categoriaAtiva !== "Todos" && (
            <button
              type="button"
              onClick={() => setCategoriaAtiva("Todos")}
              className="text-left text-sm font-bold text-pink-500 hover:text-pink-600"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {produtosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h3 className="text-xl font-black">Nenhum produto encontrado</h3>
            <p className="mt-2 text-slate-500">
              Tente pesquisar usando outro nome ou categoria.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {produtosFiltrados.map((produto) => (
              <CardProduto key={produto.id} produto={produto} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-green-50 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-black">
              Receba os achados pelo WhatsApp
            </h2>
            <p className="mt-2 text-slate-600">
              Entre no grupo e acompanhe as novas ofertas.
            </p>
          </div>
          <a
            href="https://chat.whatsapp.com/DMC6VCIcuMBJMfbfdIk8SZ?s=sh&p=i&ilr=4&amv=0"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-green-600 px-6 py-4 font-black text-white hover:bg-green-700"
          >
            Entrar no grupo
          </a>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-3">
          <div>
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-20 w-auto rounded-xl bg-white p-2"
            />
            <p className="mt-4 max-w-md text-sm leading-6">
              Produtos e ofertas selecionados em diferentes lojas e
              plataformas.
            </p>
          </div>

          <div>
            <h3 className="font-black text-white">Navegação</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <a href="#ofertas" className="hover:text-white">
                  Ofertas
                </a>
              </p>
              <p>
                <Link href="/nike" className="hover:text-white">
                  Nike
                </Link>
              </p>
              <p>
                <a
                  href="https://www.instagram.com/achadosdocasal26/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  Instagram
                </a>
              </p>
              <p>
                <a
                  href="mailto:gabrielhcalvi@hotmail.com"
                  className="hover:text-white"
                >
                  Contato
                </a>
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-black text-white">Transparência</h3>
            <p className="mt-4 text-sm leading-6">
              Alguns links publicados são links de afiliados. Podemos receber
              uma comissão quando uma compra é realizada, sem custo adicional
              para você.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-200">
              Como associado da Amazon, eu ganho com compras qualificadas.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Preços, disponibilidade, frete e condições podem mudar sem
              aviso.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
