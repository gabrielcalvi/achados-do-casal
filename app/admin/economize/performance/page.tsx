"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ItemConteudo = {
  id: number;
  nome: string;
  loja: string;
  categoria: string;
  imagem: string | null;
  preco: number | null;
  temEmCasa: boolean;
  reviewCompleta: boolean;
  videoUrl: string | null;
  videoPublicadoEm: string | null;
  atualizadoEm: string | null;
  cliquesHumanos: number;
  cliquesReview: number;
  ultimoClique: string | null;
};

type RespostaPerformance = {
  periodo: { dias: number; inicio: string; fim: string };
  filtro?: { trafego: string; descricao: string };
  resumo: {
    cliques: number;
    sessoes: number;
    cliquesPorSessao: number;
    canaisAtivos: number;
    variacaoCliques: number;
    variacaoSessoes: number;
  };
  diagnostico?: {
    humanoProvavel: number;
    bots: number;
    interno: number;
    naoClassificado: number;
    totalBruto: number;
  };
  conteudo: {
    metaSemanal: number;
    videosSemana: number;
    faltamVideos: number;
    progressoPercentual: number;
    inicioSemana: string;
    fimSemana: string;
    produtosEmCasa: number;
    reviewsCompletas: number;
    reviewsComVideo: number;
    filaSemVideo: number;
    cliquesProdutosHumanos: number;
    cliquesReviewsHumanos: number;
  };
  filaGravacao: ItemConteudo[];
  candidatosFila: ItemConteudo[];
  videosPublicados: ItemConteudo[];
  oportunidadesDemanda: ItemConteudo[];
  origens: Array<{ origem: string; quantidade: number; percentual: number }>;
  topLojas: Array<{
    lojaId: string;
    loja: string;
    slug: string | null;
    quantidade: number;
  }>;
  topOfertas: Array<{
    ofertaId: string;
    titulo: string;
    preco: number | null;
    loja: string;
    quantidade: number;
  }>;
  error?: string;
};

const ROTULOS_ORIGEM: Record<string, string> = {
  central_economize: "Central Economize",
  site: "Site",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  admin: "Admin",
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function variacao(valor: number) {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(1).replace(".0", "")}%`;
}

function dataCurta(valor: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function nomeCurto(nome: string, limite = 92) {
  if (nome.length <= limite) return nome;
  return `${nome.slice(0, limite).trim()}…`;
}

function ImagemProduto({ item }: { item: ItemConteudo }) {
  return (
    <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-2">
      {item.imagem ? (
        <img
          src={item.imagem}
          alt={item.nome}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-3xl">📦</span>
      )}
    </div>
  );
}

export default function PerformancePage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RespostaPerformance | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  const [modalFilaAberto, setModalFilaAberto] = useState(false);
  const [buscaFila, setBuscaFila] = useState("");
  const [adicionandoId, setAdicionandoId] = useState<number | null>(null);
  const [mensagemFila, setMensagemFila] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch(
          `/api/admin/economize/performance?dias=${dias}`,
          { cache: "no-store" },
        );
        const resultado = (await resposta.json()) as RespostaPerformance;
        if (!resposta.ok) {
          throw new Error(
            resultado.error || "Não foi possível carregar a performance.",
          );
        }
        if (ativo) setDados(resultado);
      } catch (error) {
        if (ativo) {
          setErro(
            error instanceof Error ? error.message : "Erro inesperado.",
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [dias, atualizacao]);

  const maiorOrigem = useMemo(
    () =>
      Math.max(
        1,
        ...(dados?.origens.map((item) => item.quantidade) ?? [1]),
      ),
    [dados],
  );

  const progresso = dados?.conteudo.progressoPercentual ?? 0;
  const metaCumprida = Boolean(
    dados && dados.conteudo.videosSemana >= dados.conteudo.metaSemanal,
  );

  const candidatosFiltrados = useMemo(() => {
    const termo = buscaFila.trim().toLocaleLowerCase("pt-BR");
    const itens = dados?.candidatosFila ?? [];
    if (!termo) return itens;
    return itens.filter((item) =>
      [item.nome, item.loja, item.categoria]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    );
  }, [buscaFila, dados?.candidatosFila]);

  async function adicionarAFila(item: ItemConteudo) {
    setAdicionandoId(item.id);
    setMensagemFila("");
    setErro("");
    try {
      const resposta = await fetch("/api/admin/economize/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId: item.id }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) {
        throw new Error(resultado.error || "Não foi possível adicionar à fila.");
      }

      setMensagemFila(`${item.nome} foi adicionado aos próximos vídeos.`);
      setAtualizacao((valor) => valor + 1);
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro inesperado ao adicionar.",
      );
    } finally {
      setAdicionandoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">
                Consultoria, conteúdo e monetização
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                📊 Painel de Performance do Casal
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                Acompanhe o que o público procura, escolha os próximos produtos
                para gravar e mantenha a meta mínima de três vídeos por semana.
                O objetivo é transformar cada achado em orientação real de
                compra, não apenas em um link de oferta.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setDias(valor)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${
                    dias === valor
                      ? "bg-white text-slate-950"
                      : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {valor} dias
                </button>
              ))}
            </div>
          </div>
        </header>

        {erro ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            {erro}
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500 p-6 text-white shadow-lg sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.16em]">
                  Meta semanal de conteúdo
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-fuchsia-700">
                  {dataCurta(dados?.conteudo.inicioSemana ?? null)} até domingo
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="text-6xl font-black">
                  {carregando ? "…" : dados?.conteudo.videosSemana ?? 0}
                </p>
                <p className="pb-2 text-xl font-black text-white/85">
                  de {dados?.conteudo.metaSemanal ?? 3} vídeos publicados
                </p>
              </div>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, progresso))}%` }}
                />
              </div>

              <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-white/85">
                {metaCumprida
                  ? "Meta cumprida! Os próximos vídeos aumentam o estoque de conteúdo consultivo e ajudam a comparar formatos e produtos."
                  : `Faltam ${dados?.conteudo.faltamVideos ?? 3} vídeo(s) para cumprir a meta desta semana.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/70">
                  Fila pronta
                </p>
                <p className="mt-2 text-4xl font-black">
                  {carregando ? "…" : dados?.conteudo.filaSemVideo ?? 0}
                </p>
                <p className="mt-1 text-sm font-bold text-white/80">
                  produtos em casa sem vídeo
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/70">
                  Biblioteca
                </p>
                <p className="mt-2 text-4xl font-black">
                  {carregando ? "…" : dados?.conteudo.reviewsComVideo ?? 0}
                </p>
                <p className="mt-1 text-sm font-bold text-white/80">
                  vídeos publicados
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/70">
                  Reviews prontas
                </p>
                <p className="mt-2 text-4xl font-black">
                  {carregando ? "…" : dados?.conteudo.reviewsCompletas ?? 0}
                </p>
                <p className="mt-1 text-sm font-bold text-white/80">
                  opiniões completas
                </p>
              </div>
              <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-wide text-white/70">
                  Interesse real
                </p>
                <p className="mt-2 text-4xl font-black">
                  {carregando
                    ? "…"
                    : dados?.conteudo.cliquesReviewsHumanos ?? 0}
                </p>
                <p className="mt-1 text-sm font-bold text-white/80">
                  cliques em recomendações
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-fuchsia-600">
                Produção da semana
              </p>
              <h2 className="mt-1 text-3xl font-black">🎬 Próximos vídeos para gravar</h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                Produtos que vocês têm em casa e ainda não possuem vídeo. A
                ordem considera procura humana, cliques na review e o nível de
                preparação da opinião do casal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setBuscaFila("");
                  setMensagemFila("");
                  setModalFilaAberto(true);
                }}
                className="w-fit rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-fuchsia-700"
              >
                + Adicionar à fila
              </button>
              <Link
                href="/admin"
                className="w-fit rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Editar produtos →
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {(dados?.filaGravacao ?? []).slice(0, 6).map((item, indice) => (
              <article
                key={item.id}
                className="flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex gap-4">
                  <ImagemProduto item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                        Pauta {indice + 1}
                      </span>
                      {item.reviewCompleta ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800">
                          Review pronta
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                          Completar opinião
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 font-black leading-6">
                      {nomeCurto(item.nome, 74)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.loja} · {item.categoria}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xl font-black">{item.cliquesHumanos}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      cliques
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xl font-black">{item.cliquesReview}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      review
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-sm font-black">
                      {moeda(item.preco) || "—"}
                    </p>
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      preço
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={`/produto/${item.id}`}
                    target="_blank"
                    className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    Ver página
                  </Link>
                  <Link
                    href="/admin"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Adicionar vídeo
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {!carregando && (dados?.filaGravacao.length ?? 0) === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-3 font-black text-emerald-900">
                Todos os produtos disponíveis em casa já possuem vídeo.
              </p>
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-600">
                O público está pedindo
              </p>
              <h2 className="mt-1 text-2xl font-black">Pautas guiadas por demanda</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Produtos que ainda não estão em casa, mas já receberam cliques.
                Servem para decidir futuras compras, empréstimos ou conteúdos de
                comparação e pesquisa.
              </p>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.oportunidadesDemanda ?? []).map((item, indice) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
                    {indice + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{nomeCurto(item.nome, 72)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.loja} · {item.categoria}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">{item.cliquesHumanos}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">
                      cliques
                    </p>
                  </div>
                </div>
              ))}
              {!carregando &&
              (dados?.oportunidadesDemanda.length ?? 0) === 0 ? (
                <p className="py-5 text-sm text-slate-500">
                  Ainda não há uma pauta externa com demanda suficiente no
                  período selecionado.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">
                Biblioteca consultiva
              </p>
              <h2 className="mt-1 text-2xl font-black">Vídeos já publicados</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Acompanhe o acervo de conteúdo real e os cliques gerados pelas
                recomendações de compra.
              </p>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.videosPublicados ?? []).map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-2xl">
                    ▶️
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{nomeCurto(item.nome, 70)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Publicado em {dataCurta(item.videoPublicadoEm)} · {item.cliquesReview} clique(s) de review
                    </p>
                  </div>
                  {item.videoUrl ? (
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white transition hover:bg-red-700"
                    >
                      Assistir ↗
                    </a>
                  ) : null}
                </div>
              ))}
              {!carregando && (dados?.videosPublicados.length ?? 0) === 0 ? (
                <p className="py-5 text-sm text-slate-500">
                  O primeiro vídeo aparecerá aqui assim que for adicionado ao
                  produto.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              titulo: "Cliques humanos",
              valor: dados?.resumo.cliques ?? 0,
              detalhe: dados ? variacao(dados.resumo.variacaoCliques) : "—",
            },
            {
              titulo: "Sessões humanas",
              valor: dados?.resumo.sessoes ?? 0,
              detalhe: dados ? variacao(dados.resumo.variacaoSessoes) : "—",
            },
            {
              titulo: "Cliques / sessão",
              valor: dados?.resumo.cliquesPorSessao ?? 0,
              detalhe: "engajamento",
            },
            {
              titulo: "Cliques em produtos",
              valor: dados?.conteudo.cliquesProdutosHumanos ?? 0,
              detalhe: "intenção de compra",
            },
          ].map((card) => (
            <div
              key={card.titulo}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-bold text-slate-500">{card.titulo}</p>
              <p className="mt-2 text-3xl font-black">
                {carregando ? "…" : card.valor}
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">
                {card.detalhe}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-600">
                  Distribuição
                </p>
                <h2 className="mt-1 text-2xl font-black">Cliques por canal</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                últimos {dias} dias
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {(dados?.origens ?? []).map((item) => (
                <div key={item.origem}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-black">
                      {ROTULOS_ORIGEM[item.origem] || item.origem}
                    </span>
                    <span className="font-bold text-slate-500">
                      {item.quantidade} · {item.percentual}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${Math.max(
                          4,
                          (item.quantidade / maiorOrigem) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {!carregando && (dados?.origens.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">
                  Ainda não há cliques humanos no período.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-600">
                Interesse comercial
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Top ofertas por clique humano
              </h2>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {(dados?.topOfertas ?? []).map((oferta, indice) => (
                <div
                  key={oferta.ofertaId}
                  className="flex gap-4 py-4 first:pt-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                    {indice + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{oferta.titulo}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {oferta.loja}
                      {moeda(oferta.preco) ? ` · ${moeda(oferta.preco)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">{oferta.quantidade}</p>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      cliques
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-violet-600">
                Parceiros
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Lojas com mais cliques humanos
              </h2>
            </div>
            <Link
              href="/admin/economize"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Voltar à Central
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(dados?.topLojas ?? []).slice(0, 5).map((loja) => (
              <div key={loja.lojaId} className="rounded-2xl bg-slate-50 p-4">
                <p className="truncate text-sm font-black">{loja.loja}</p>
                <p className="mt-2 text-3xl font-black">{loja.quantidade}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  cliques humanos
                </p>
              </div>
            ))}
          </div>
        </section>

        {modalFilaAberto ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setModalFilaAberto(false);
            }}
          >
            <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-fuchsia-600">
                    Planejamento de conteúdo
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    + Adicionar próximo produto para vídeo
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Escolha um produto já cadastrado e sem vídeo. Ao adicionar,
                    ele passa para a fila “Próximos vídeos para gravar”.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalFilaAberto(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-500 hover:bg-slate-50"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <input
                  type="search"
                  value={buscaFila}
                  onChange={(event) => setBuscaFila(event.target.value)}
                  placeholder="Buscar produto, loja ou categoria..."
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-fuchsia-500"
                  autoFocus
                />

                {mensagemFila ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    ✅ {mensagemFila}
                  </div>
                ) : null}

                <div className="mt-5 max-h-[54vh] space-y-3 overflow-y-auto pr-1">
                  {candidatosFiltrados.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 p-3"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2">
                        {item.imagem ? (
                          <img
                            src={item.imagem}
                            alt={item.nome}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black">{nomeCurto(item.nome, 84)}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.loja} · {item.categoria}
                          {moeda(item.preco) ? ` · ${moeda(item.preco)}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={adicionandoId === item.id}
                        onClick={() => void adicionarAFila(item)}
                        className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {adicionandoId === item.id ? "Adicionando..." : "Adicionar"}
                      </button>
                    </div>
                  ))}

                  {!carregando && candidatosFiltrados.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                      Nenhum produto disponível neste filtro.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <details>
            <summary className="cursor-pointer font-black text-slate-700">
              Diagnóstico técnico do tráfego
            </summary>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  titulo: "Humano provável",
                  valor: dados?.diagnostico?.humanoProvavel ?? 0,
                  detalhe: "entra nas métricas",
                  classe: "border-emerald-200 bg-emerald-50",
                },
                {
                  titulo: "Bots",
                  valor: dados?.diagnostico?.bots ?? 0,
                  detalhe: "excluídos",
                  classe: "border-amber-200 bg-amber-50",
                },
                {
                  titulo: "Interno",
                  valor: dados?.diagnostico?.interno ?? 0,
                  detalhe: "admin / testes",
                  classe: "border-blue-200 bg-blue-50",
                },
                {
                  titulo: "Não classificado",
                  valor: dados?.diagnostico?.naoClassificado ?? 0,
                  detalhe: "fora das métricas",
                  classe: "border-slate-200 bg-white",
                },
              ].map((card) => (
                <div
                  key={card.titulo}
                  className={`rounded-2xl border p-4 ${card.classe}`}
                >
                  <p className="text-sm font-bold text-slate-600">
                    {card.titulo}
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {carregando ? "…" : card.valor}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    {card.detalhe}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
