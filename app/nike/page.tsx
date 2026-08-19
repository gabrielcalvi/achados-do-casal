"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LojaOferta = {
  id: string;
  nome: string;
  slug: string;
};

type OfertaNike = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  codigo: string | null;
  categoria: string | null;
  imagem_url: string | null;
  desconto_percentual: number | null;
  preco_original: number | null;
  preco_oferta: number | null;
  validade: string | null;
  destaque: boolean;
  origem: string;
  loja: LojaOferta | null;
};

type RespostaOfertas = {
  ofertas?: OfertaNike[];
  total?: number;
  error?: string;
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function dataCurta(valor: string | null) {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NikePage() {
  const [ofertas, setOfertas] = useState<OfertaNike[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch("/api/economize/ofertas?loja=nike", {
          cache: "no-store",
        });
        const dados = (await resposta.json()) as RespostaOfertas;

        if (!resposta.ok) {
          throw new Error(dados.error || "Não foi possível carregar a seleção Nike.");
        }

        if (ativo) setOfertas(dados.ofertas ?? []);
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Erro ao carregar ofertas Nike.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ofertas;

    return ofertas.filter((oferta) =>
      [oferta.titulo, oferta.categoria, oferta.descricao]
        .filter(Boolean)
        .some((texto) => String(texto).toLowerCase().includes(termo)),
    );
  }, [busca, ofertas]);

  const comImagem = filtradas.filter((oferta) => oferta.imagem_url);
  const destaques = ofertas.filter((oferta) => oferta.destaque).length;
  const melhorDesconto = ofertas.reduce(
    (maior, oferta) => Math.max(maior, Number(oferta.desconto_percentual) || 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-black">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo-achados-do-casal.png"
              alt="Achados do Casal"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/economize"
              className="rounded-full border border-black px-4 py-2 text-sm font-black transition hover:bg-black hover:text-white"
            >
              Economize
            </Link>
            <Link
              href="/"
              className="rounded-full bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </header>

      <section className="overflow-hidden bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-zinc-400">
              Parceiro AWIN · seleção do Achados
            </p>
            <h1 className="mt-5 text-6xl font-black tracking-[-0.06em] sm:text-7xl lg:text-8xl">
              NIKE
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Produtos e oportunidades encontrados no catálogo oficial do parceiro,
              filtrados para destacar preço, desconto e relevância.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs font-bold text-zinc-400">Ativos</p>
              <p className="mt-2 text-3xl font-black">{ofertas.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs font-bold text-zinc-400">Destaques</p>
              <p className="mt-2 text-3xl font-black">{destaques}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs font-bold text-zinc-400">Até</p>
              <p className="mt-2 text-3xl font-black">
                {melhorDesconto > 0 ? `${Math.round(melhorDesconto)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Achados Nike
            </p>
            <h2 className="mt-1 text-2xl font-black">Escolha pelo que vale a pena hoje</h2>
          </div>

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar tênis, roupa, esporte..."
            className="h-12 w-full rounded-full border border-zinc-300 bg-zinc-50 px-5 outline-none transition focus:border-black focus:bg-white sm:max-w-md"
          />
        </div>

        {carregando ? (
          <div className="mt-6 rounded-3xl bg-white p-14 text-center shadow-sm">
            <p className="text-lg font-black">Carregando seleção Nike...</p>
            <p className="mt-2 text-zinc-500">Consultando as oportunidades disponíveis agora.</p>
          </div>
        ) : erro ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <p className="text-xl font-black text-red-900">Não foi possível carregar agora</p>
            <p className="mt-2 text-red-700">{erro}</p>
          </div>
        ) : comImagem.length === 0 ? (
          <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Vitrine conectada
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">
                  A seleção Nike está pronta para receber os achados.
                </h2>
                <p className="mt-4 max-w-2xl leading-7 text-zinc-600">
                  Assim que o catálogo oficial da AWIN entregar produtos ou promoções
                  elegíveis, eles aparecem aqui automaticamente, sempre usando o link
                  oficial de afiliado do Achados do Casal.
                </p>
              </div>
              <Link
                href="/economize"
                className="rounded-full bg-black px-6 py-4 text-center font-black text-white hover:bg-zinc-800"
              >
                Ver outras ofertas
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {comImagem.map((oferta) => {
              const precoAtual = moeda(oferta.preco_oferta);
              const precoOriginal = moeda(oferta.preco_original);
              const validade = dataCurta(oferta.validade);
              const desconto = Number(oferta.desconto_percentual) || 0;
              const paginaProduto = `/achado/${oferta.id}`;

              return (
                <article
                  key={oferta.id}
                  className="group flex min-h-[470px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <Link
                    href={paginaProduto}
                    className="relative flex h-64 items-center justify-center bg-[#f7f7f7] p-5"
                  >
                    {desconto > 0 ? (
                      <span className="absolute left-4 top-4 z-10 rounded-full bg-black px-3 py-2 text-xs font-black text-white">
                        -{Math.round(desconto)}%
                      </span>
                    ) : null}
                    {oferta.codigo ? (
                      <span className="absolute right-4 top-4 z-10 rounded-full border border-black/10 bg-white px-3 py-2 text-[11px] font-black uppercase">
                        Cupom oficial
                      </span>
                    ) : null}
                    <img
                      src={oferta.imagem_url || ""}
                      alt={oferta.titulo}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                    />
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Nike {oferta.categoria ? `· ${oferta.categoria}` : ""}
                    </p>
                    <h3 className="mt-2 line-clamp-3 text-lg font-black leading-6">
                      {oferta.titulo}
                    </h3>

                    <div className="mt-auto pt-5">
                      {precoOriginal && oferta.preco_original && oferta.preco_oferta && Number(oferta.preco_original) > Number(oferta.preco_oferta) ? (
                        <p className="text-sm text-zinc-400 line-through">{precoOriginal}</p>
                      ) : null}
                      <p className="mt-1 text-2xl font-black">{precoAtual || "Ver condição"}</p>

                      {oferta.codigo ? (
                        <p className="mt-2 rounded-xl bg-zinc-100 px-3 py-2 text-center text-xs font-black">
                          Código: {oferta.codigo}
                        </p>
                      ) : null}

                      <Link
                        href={paginaProduto}
                        className="mt-4 flex h-12 items-center justify-center rounded-full bg-black px-5 font-black text-white transition hover:bg-zinc-800"
                      >
                        Ver produto
                      </Link>

                      <p className="mt-2 text-center text-[10px] leading-4 text-zinc-400">
                        Página compartilhável do Achados. Preço e disponibilidade podem mudar.
                        {validade ? ` Válido até ${validade}.` : ""}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14">
        <div className="rounded-3xl bg-black p-7 text-white sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
            Transparência
          </p>
          <p className="mt-3 max-w-4xl leading-7 text-zinc-300">
            Esta é uma seleção editorial do Achados do Casal. Produtos, preços e
            materiais exibidos vêm das fontes autorizadas do programa de afiliados.
            O ranking não é vendido e o parceiro não define quais ofertas recebem
            destaque.
          </p>
        </div>
      </section>
    </main>
  );
}
