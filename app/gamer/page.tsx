"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  parcelamento: string;
  link: string;
  link_afiliado?: string | null;
  selo?: string;
  avaliacao?: number;
  vendas?: string;
  parcelas?: string;
  freteGratis: boolean;
  destaque: boolean;
  gamer: boolean;
  itemEmCasa: boolean;
  reviewCompleta?: boolean;
};

export default function GamerPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dominioPlayer, setDominioPlayer] = useState("");

  useEffect(() => {
    setDominioPlayer(window.location.hostname);

    async function carregarProdutosGamer() {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .eq("gamer", true)
        .order("id", { ascending: false });

      if (error) {
        console.error("Erro ao carregar produtos Gamer:", error);
        setCarregando(false);
        return;
      }

      const produtosFormatados: Produto[] = (data || []).map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        loja: produto.loja,
        categoria: produto.categoria,
        imagem: produto.imagem,
        precoAnterior: produto.preco_antigo,
        precoAtual: produto.preco_atual,
        pagamento: produto.cupom || "",
        parcelamento: produto.cupom || "",
        link: produto.link,
        link_afiliado: produto.link_afiliado,
        selo: produto.destaque ? "Destaque" : "",
        avaliacao: produto.avaliacao,
        vendas: produto.vendas,
        parcelas: produto.parcelas,
        freteGratis: produto.frete_gratis,
        destaque: produto.destaque,
        gamer: produto.gamer ?? false,
        itemEmCasa: produto.tem_em_casa ?? false,
        reviewCompleta: produto.review_completa ?? false,
      }));

      setProdutos(produtosFormatados);
      setCarregando(false);
    }

    carregarProdutosGamer();
  }, []);

  const produtosDoSetup = useMemo(
    () => produtos.filter((produto) => produto.itemEmCasa),
    [produtos]
  );

  const outrasOfertas = useMemo(
    () => produtos.filter((produto) => !produto.itemEmCasa),
    [produtos]
  );

  const urlPlayer = dominioPlayer
    ? `https://player.twitch.tv/?channel=gabrielcalvigamer&parent=${encodeURIComponent(
        dominioPlayer
      )}&autoplay=false&muted=true`
    : "";

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-12 w-auto"
            />
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Ofertas
            </Link>

            <Link
              href="/gamer"
              className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white transition hover:bg-red-700"
            >
              🎮 Gamer
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex rounded-full bg-red-600/20 px-4 py-2 text-sm font-bold text-red-300">
              CALVI GAMER
            </div>

            <h1 className="text-3xl font-black sm:text-5xl">
              Ofertas selecionadas por quem realmente joga
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Aqui estão os produtos que uso no meu setup, equipamentos que
              aparecem nas minhas lives e ofertas Gamer selecionadas na Kabum,
              Amazon e Mercado Livre.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://www.twitch.tv/gabrielcalvigamer"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700"
              >
                Seguir na Twitch
              </a>

              <a
                href="https://kick.com/gabrielcalvigamer"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-green-600 px-5 py-3 font-black text-white transition hover:bg-green-700"
              >
                Ver na Kick
              </a>

              <a
                href="https://www.youtube.com/@gabrielcalvigamer"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-600 px-5 py-3 font-black text-white transition hover:bg-slate-800"
              >
                YouTube
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-black">
            <div className="border-b border-slate-700 px-4 py-3">
              <p className="font-black">🔴 Live do Calvi Gamer</p>
              <p className="text-sm text-slate-400">
                Quando eu estiver ao vivo, a transmissão aparece aqui.
              </p>
            </div>

            <div className="aspect-video">
              {urlPlayer ? (
                <iframe
                  src={urlPlayer}
                  title="Live do Calvi Gamer na Twitch"
                  className="h-full w-full"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  Carregando player...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-wider text-red-600">
            Testados e utilizados
          </p>

          <h2 className="mt-2 text-3xl font-black text-slate-900">
            🎮 Produtos do meu setup
          </h2>

          <p className="mt-2 text-slate-600">
            Produtos que eu realmente tenho em casa e uso nas lives.
          </p>
        </div>

        {carregando ? (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
            Carregando produtos...
          </div>
        ) : produtosDoSetup.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {produtosDoSetup.map((produto) => (
              <CardProduto key={produto.id} produto={produto} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-bold text-slate-800">
              Nenhum produto do setup marcado ainda.
            </p>

            <p className="mt-2 text-slate-500">
              Marque também “O Casal tem este produto em casa” no painel.
            </p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-wider text-red-600">
            Seleção Gamer
          </p>

          <h2 className="mt-2 text-3xl font-black text-slate-900">
            Ofertas para melhorar seu setup
          </h2>

          <p className="mt-2 text-slate-600">
            Monitores, periféricos, componentes, consoles e acessórios.
          </p>
        </div>

        {carregando ? (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
            Carregando ofertas...
          </div>
        ) : outrasOfertas.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {outrasOfertas.map((produto) => (
              <CardProduto key={produto.id} produto={produto} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-bold text-slate-800">
              Novas ofertas Gamer serão adicionadas em breve.
            </p>
          </div>
        )}
      </section>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>Achados do Casal — Ofertas Gamer selecionadas de verdade.</p>

          <Link href="/" className="font-bold text-white hover:text-red-400">
            Voltar para todas as ofertas
          </Link>
        </div>
      </footer>
    </main>
  );
}