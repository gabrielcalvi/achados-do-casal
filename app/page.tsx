"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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



const categorias = [
  "Todos",
  "Automotivo",
  "Casa e Cozinha",
  "Tecnologia",
  "Ferramentas",
  "Infantil",
  "Moda",
];

function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularDesconto(precoAnterior?: number, precoAtual?: number) {
  if (!precoAnterior || !precoAtual || precoAnterior <= precoAtual) {
    return null;
  }

  return Math.round(
    ((precoAnterior - precoAtual) / precoAnterior) * 100,
  );
}

export default function Home() {
  const [pesquisa, setPesquisa] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoDestaque, setProdutoDestaque] = useState<Produto | null>(null);
  useEffect(() => {
  async function carregarProdutos() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true);
      console.log("DATA:", data);
      console.log(
  "TEM EM CASA:",
  data?.map((p) => ({
    nome: p.nome,
    tem_em_casa: p.tem_em_casa,
  }))
);
      console.log("ERROR:", error);

    if (error) {
      console.error(error);
      return;
    }

    setProdutos(
      (data || []).map((p) => ({
        id: p.id,
        nome: p.nome,
        loja: p.loja,
        categoria: p.categoria,
        imagem: p.imagem,
        precoAnterior: p.preco_antigo,
        precoAtual: p.preco_atual,
        pagamento: p.cupom || "",
        link: p.link,
        link_afiliado: p.link_afiliado,
        selo: p.destaque ? "Oferta" : "",
        avaliacao: p.avaliacao,
vendas: p.vendas,
parcelas: p.parcelas,
freteGratis: p.frete_gratis,
destaque: p.destaque,
temEmCasa: p.tem_em_casa ?? false,
reviewCompleta: p.review_completa ?? false,
      }))
    );
   

// COLE AQUI ↓↓↓

const destaqueEncontrado = data?.find((p) => p.destaque);

if (destaqueEncontrado) {
  setProdutoDestaque({
    id: destaqueEncontrado.id,
    nome: destaqueEncontrado.nome,
    loja: destaqueEncontrado.loja,
    categoria: destaqueEncontrado.categoria,
    imagem: destaqueEncontrado.imagem,
    precoAnterior: destaqueEncontrado.preco_antigo,
    precoAtual: destaqueEncontrado.preco_atual,
    pagamento: destaqueEncontrado.cupom || "",
    link: destaqueEncontrado.link,
    selo: "Oferta",
    avaliacao: destaqueEncontrado.avaliacao,
    vendas: destaqueEncontrado.vendas,
    parcelas: destaqueEncontrado.parcelas,
    freteGratis: destaqueEncontrado.frete_gratis,
    destaque: destaqueEncontrado.destaque,
  });
} else {
  setProdutoDestaque(null);
}

} // fecha carregarProdutos()

carregarProdutos();
}, []);


  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return produtos.filter((produto) => {
      const correspondeCategoria =
        categoriaAtiva === "Todos" ||
        produto.categoria === categoriaAtiva;

      const correspondePesquisa =
        !termo ||
        produto.nome.toLowerCase().includes(termo) ||
        produto.loja.toLowerCase().includes(termo) ||
        produto.categoria.toLowerCase().includes(termo);

      return correspondeCategoria && correspondePesquisa;
    });
  }, [pesquisa, categoriaAtiva, produtos]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
          <a href="/" className="shrink-0">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-16 w-auto object-contain"
            />
          </a>

          <div className="flex flex-1 gap-2">
            <input
              type="search"
              value={pesquisa}
              onChange={(evento) => setPesquisa(evento.target.value)}
              placeholder="Pesquisar produtos, categorias ou lojas..."
              className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none transition focus:border-blue-900 focus:bg-white"
            />

            <button className="hidden rounded-xl bg-blue-950 px-6 font-bold text-white hover:bg-blue-900 sm:block">
              Buscar
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://www.instagram.com/achadosdocasal26/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-pink-500 px-4 py-3 text-sm font-bold text-white hover:bg-pink-600"
            >
              Instagram
            </a>

            <a
              href="https://chat.whatsapp.com/DMC6VCIcuMBJMfbfdIk8SZ?s=sh&p=i&ilr=4&amv=0"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3">
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
        </div>
      </header>

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
        Produtos variados, preços interessantes e ofertas selecionadas nas
        maiores lojas do Brasil.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#ofertas"
          className="rounded-xl bg-pink-500 px-6 py-4 font-black text-white hover:bg-pink-600"
        >
          Ver ofertas
        </a>

        <a
          href="https://chat.whatsapp.com/DMC6VCIcuMBJMfbfdIk8SZ?s=sh&p=i&ilr=4&amv=0"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/40 px-6 py-4 font-black text-white hover:bg-white/10"
        >
          Entrar no grupo
        </a>
      </div>
    </div>

    <HeroDestaque produto={produtoDestaque} />
  </div>
</section>
      <section id="ofertas" className="mx-auto max-w-7xl px-5 py-14">
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
            <h3 className="text-xl font-black">
              Nenhum produto encontrado
            </h3>

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
            <h3 className="font-black text-white">
              Transparência
            </h3>

            <p className="mt-4 text-sm leading-6">
              Alguns links publicados são links de afiliados. Podemos
              receber uma comissão quando uma compra é realizada, sem
              custo adicional para você.
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