"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LojaOferta = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
  ativa: boolean;
  ordem: number;
};

type OfertaPublica = {
  id: string;
  loja_id: string;
  tipo:
    | "cupom"
    | "cashback"
    | "promocao"
    | "campanha"
    | "frete_gratis";
  titulo: string;
  descricao: string | null;
  codigo: string | null;
  categoria: string | null;
  regras: string | null;
  imagem_url: string | null;
  desconto_percentual: number | null;
  valor_desconto: number | null;
  cashback_percentual: number | null;
  pedido_minimo: number | null;
  preco_original: number | null;
  preco_oferta: number | null;
  data_inicio: string | null;
  validade: string | null;
  destaque: boolean;
  selos: string[];
  origem: string;
  updated_at: string;
  loja: LojaOferta | null;
};

type RespostaOfertas = {
  ofertas?: OfertaPublica[];
  total?: number;
  atualizadoEm?: string;
  error?: string;
};

const tipos = [
  { valor: "todos", rotulo: "Todas", icone: "💰" },
  { valor: "cupom", rotulo: "Cupons", icone: "🏷️" },
  { valor: "cashback", rotulo: "Cashback", icone: "💵" },
  { valor: "promocao", rotulo: "Promoções", icone: "🔥" },
  { valor: "campanha", rotulo: "Campanhas", icone: "🎁" },
  { valor: "frete_gratis", rotulo: "Frete grátis", icone: "📦" },
];

const rotulosTipo: Record<OfertaPublica["tipo"], string> = {
  cupom: "Cupom",
  cashback: "Cashback",
  promocao: "Promoção",
  campanha: "Campanha",
  frete_gratis: "Frete grátis",
};

const iconesTipo: Record<OfertaPublica["tipo"], string> = {
  cupom: "🏷️",
  cashback: "💵",
  promocao: "🔥",
  campanha: "🎁",
  frete_gratis: "📦",
};

function formatarMoeda(valor: number | null) {
  if (valor === null) return null;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(valor: string | null) {
  if (!valor) return null;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ehCupom(oferta: OfertaPublica) {
  return Boolean(oferta.codigo?.trim());
}

export default function EconomizePage() {
  const [ofertas, setOfertas] = useState<OfertaPublica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState("todas");
  const [tipoSelecionado, setTipoSelecionado] = useState("todos");
  const [codigoCopiado, setCodigoCopiado] = useState<string | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarOfertas() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch("/api/economize/ofertas", {
          method: "GET",
          cache: "no-store",
        });

        const resultado = (await resposta.json()) as RespostaOfertas;

        if (!resposta.ok) {
          throw new Error(
            resultado.error || "Não foi possível carregar as oportunidades."
          );
        }

        if (componenteAtivo) {
          setOfertas(resultado.ofertas ?? []);
        }
      } catch (error) {
        console.error("Erro ao carregar a Central Economize:", error);

        if (componenteAtivo) {
          setErro(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar as oportunidades."
          );
        }
      } finally {
        if (componenteAtivo) setCarregando(false);
      }
    }

    carregarOfertas();

    return () => {
      componenteAtivo = false;
    };
  }, [atualizacao]);

  const lojasDisponiveis = useMemo(() => {
    const lojasPorSlug = new Map<string, LojaOferta>();

    ofertas.forEach((oferta) => {
      if (oferta.loja) lojasPorSlug.set(oferta.loja.slug, oferta.loja);
    });

    return Array.from(lojasPorSlug.values()).sort((a, b) => a.ordem - b.ordem);
  }, [ofertas]);

  const contagemTipos = useMemo(() => {
    return {
      todos: ofertas.length,
      cupom: ofertas.filter(ehCupom).length,
      cashback: ofertas.filter((oferta) => oferta.tipo === "cashback").length,
      promocao: ofertas.filter((oferta) => oferta.tipo === "promocao").length,
      campanha: ofertas.filter((oferta) => oferta.tipo === "campanha").length,
      frete_gratis: ofertas.filter((oferta) => oferta.tipo === "frete_gratis").length,
    };
  }, [ofertas]);

  const tiposDisponiveis = useMemo(
    () =>
      tipos.filter(
        (tipo) =>
          tipo.valor === "todos" ||
          contagemTipos[tipo.valor as keyof typeof contagemTipos] > 0
      ),
    [contagemTipos]
  );

  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter((oferta) => {
      const correspondeLoja =
        lojaSelecionada === "todas" || oferta.loja?.slug === lojaSelecionada;

      const correspondeTipo =
        tipoSelecionado === "todos" ||
        (tipoSelecionado === "cupom"
          ? ehCupom(oferta)
          : oferta.tipo === tipoSelecionado);

      return correspondeLoja && correspondeTipo;
    });
  }, [ofertas, lojaSelecionada, tipoSelecionado]);

  const oportunidadesDestaque = useMemo(
    () => ofertas.filter((oferta) => oferta.destaque).length,
    [ofertas]
  );

  async function copiarCodigo(ofertaId: string, codigo: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(codigo);
      setCodigoCopiado(ofertaId);

      window.setTimeout(() => {
        setCodigoCopiado((idAtual) => (idAtual === ofertaId ? null : idAtual));
      }, 3000);

      return true;
    } catch (error) {
      console.error("Erro ao copiar código:", error);
      alert("Não foi possível copiar o código automaticamente.");
      return false;
    }
  }

  async function usarCupom(ofertaId: string, codigo: string) {
    const novaAba = window.open("about:blank", "_blank");
    if (novaAba) novaAba.opener = null;

    const copiado = await copiarCodigo(ofertaId, codigo);

    if (!copiado) {
      novaAba?.close();
      return;
    }

    const destino = `/oferta/${ofertaId}`;

    if (novaAba) {
      novaAba.location.href = destino;
    } else {
      window.location.href = destino;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 p-6 text-white shadow-xl sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
                Achados do Casal
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">
                💰 Central Economize
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
                Cupons e promoções verificadas, com regras claras e acesso direto à
                oportunidade para você economizar sem perder tempo.
              </p>
            </div>

            <Link
              href="/"
              className="w-fit rounded-xl border border-white/40 bg-white/10 px-5 py-3 font-black text-white backdrop-blur transition hover:bg-white/20"
            >
              Voltar ao início
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur sm:p-4">
              <p className="text-xs font-bold text-emerald-100 sm:text-sm">Ativas</p>
              <p className="mt-1 text-2xl font-black sm:text-3xl">{ofertas.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur sm:p-4">
              <p className="text-xs font-bold text-emerald-100 sm:text-sm">Destaques</p>
              <p className="mt-1 text-2xl font-black sm:text-3xl">{oportunidadesDestaque}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur sm:p-4">
              <p className="text-xs font-bold text-emerald-100 sm:text-sm">Lojas</p>
              <p className="mt-1 text-2xl font-black sm:text-3xl">{lojasDisponiveis.length}</p>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
                Economize agora
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                Encontre a melhor oportunidade
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {ofertasFiltradas.length} {ofertasFiltradas.length === 1 ? "oportunidade encontrada" : "oportunidades encontradas"}.
              </p>
            </div>

            <label className="grid w-full gap-2 lg:w-auto">
              <span className="text-sm font-bold text-slate-600">Loja</span>
              <select
                value={lojaSelecionada}
                onChange={(event) => setLojaSelecionada(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 lg:min-w-64"
              >
                <option value="todas">Todas as lojas</option>
                {lojasDisponiveis.map((loja) => (
                  <option key={loja.id} value={loja.slug}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {tiposDisponiveis.map((tipo) => {
              const selecionado = tipoSelecionado === tipo.valor;
              const quantidade = contagemTipos[tipo.valor as keyof typeof contagemTipos];

              return (
                <button
                  key={tipo.valor}
                  type="button"
                  onClick={() => setTipoSelecionado(tipo.valor)}
                  className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm font-black transition ${
                    selecionado
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  {tipo.icone} {tipo.rotulo} · {quantidade}
                </button>
              );
            })}
          </div>
        </section>

        {carregando ? (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-5xl">⏳</div>
            <h2 className="mt-4 text-xl font-black">Carregando oportunidades...</h2>
            <p className="mt-2 text-slate-500">Buscando as condições disponíveis agora.</p>
          </section>
        ) : erro ? (
          <section className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="text-5xl">⚠️</div>
            <h2 className="mt-4 text-xl font-black text-red-800">
              Não foi possível carregar as oportunidades
            </h2>
            <p className="mt-2 text-red-700">{erro}</p>
            <button
              type="button"
              onClick={() => setAtualizacao((valorAtual) => valorAtual + 1)}
              className="mt-5 cursor-pointer rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </section>
        ) : ofertasFiltradas.length === 0 ? (
          <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="text-6xl">💰</div>
            <h2 className="mt-5 text-2xl font-black">Nenhuma oportunidade neste filtro</h2>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-500">
              Tente outra loja ou categoria para encontrar cupons e promoções disponíveis.
            </p>
            {(lojaSelecionada !== "todas" || tipoSelecionado !== "todos") && (
              <button
                type="button"
                onClick={() => {
                  setLojaSelecionada("todas");
                  setTipoSelecionado("todos");
                }}
                className="mt-6 cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700"
              >
                Limpar filtros
              </button>
            )}
          </section>
        ) : (
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            {ofertasFiltradas.map((oferta) => {
              const precoOriginal = formatarMoeda(oferta.preco_original);
              const precoOferta = formatarMoeda(oferta.preco_oferta);
              const valorDesconto = formatarMoeda(oferta.valor_desconto);
              const pedidoMinimo = formatarMoeda(oferta.pedido_minimo);
              const validade = formatarData(oferta.validade);
              const cupom = ehCupom(oferta);
              const mostrarBeneficioFixo = Boolean(valorDesconto && !precoOferta);

              return (
                <article
                  key={oferta.id}
                  className={`grid overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg lg:grid-cols-[175px_minmax(0,1fr)] xl:grid-cols-[195px_minmax(0,1fr)] ${
                    oferta.destaque
                      ? "border-orange-300 ring-2 ring-orange-100"
                      : "border-slate-200"
                  }`}
                >
                  {oferta.imagem_url && (
                    <div className="flex h-44 items-center justify-center bg-gradient-to-br from-white to-slate-50 p-4 lg:h-full lg:min-h-[260px] lg:border-r lg:border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={oferta.imagem_url}
                        alt={oferta.titulo}
                        className="max-h-36 w-full object-contain sm:max-h-40 lg:max-h-48"
                      />
                    </div>
                  )}

                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{iconesTipo[oferta.tipo]}</span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-emerald-600">
                            {rotulosTipo[oferta.tipo]}
                          </p>
                          <p className="text-sm font-bold text-slate-500">
                            {oferta.loja?.nome || "Loja parceira"}
                          </p>
                        </div>
                      </div>

                      {oferta.destaque && (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                          ⭐ Destaque
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 line-clamp-3 text-lg font-black leading-6 text-slate-900 sm:text-xl">
                      {oferta.titulo}
                    </h3>

                    {oferta.descricao && !cupom && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 sm:text-base">
                        {oferta.descricao}
                      </p>
                    )}

                    {(oferta.categoria || oferta.selos.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {oferta.categoria && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {oferta.categoria}
                          </span>
                        )}
                        {oferta.selos.map((selo) => (
                          <span
                            key={selo}
                            className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700"
                          >
                            {selo}
                          </span>
                        ))}
                      </div>
                    )}

                    {cupom && oferta.codigo && (
                      <div className="mt-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                          Código do cupom
                        </p>
                        <p className="mt-0.5 break-all text-xl font-black tracking-tight text-emerald-950 sm:text-2xl">
                          {oferta.codigo}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {precoOferta && (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 sm:col-span-2">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                                Preço da oferta
                              </p>
                              <p className="mt-0.5 text-3xl font-black tracking-tight text-emerald-900">
                                {precoOferta}
                              </p>
                              {precoOriginal && (
                                <p className="mt-1 text-sm text-slate-400">
                                  De <span className="line-through">{precoOriginal}</span>
                                </p>
                              )}
                            </div>
                            {valorDesconto && (
                              <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                  Você economiza
                                </p>
                                <p className="text-lg font-black text-emerald-700">{valorDesconto}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {mostrarBeneficioFixo && (
                        <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3">
                          <p className="text-xs font-bold text-slate-500">Benefício</p>
                          <p className="mt-0.5 text-2xl font-black text-emerald-700">
                            {valorDesconto} OFF
                          </p>
                        </div>
                      )}

                      {oferta.desconto_percentual !== null && (
                        <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3">
                          <p className="text-xs font-bold text-slate-500">Desconto</p>
                          <p className="mt-0.5 text-2xl font-black text-emerald-700">
                            {oferta.desconto_percentual}% OFF
                          </p>
                        </div>
                      )}

                      {oferta.cashback_percentual !== null && (
                        <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3">
                          <p className="text-xs font-bold text-slate-500">Cashback</p>
                          <p className="mt-0.5 text-2xl font-black text-emerald-700">
                            {oferta.cashback_percentual}%
                          </p>
                        </div>
                      )}

                      {pedidoMinimo && (
                        <div className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-bold text-slate-500">Pedido mínimo</p>
                          <p className="mt-0.5 font-black text-slate-800">{pedidoMinimo}</p>
                        </div>
                      )}
                    </div>

                    {oferta.regras && (
                      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <summary className="cursor-pointer text-sm font-black text-slate-700">
                          Ver regras e condições
                        </summary>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {oferta.regras}
                        </p>
                      </details>
                    )}

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="text-sm text-slate-500">
                          {validade ? (
                            <p>
                              Válido até <strong className="text-slate-700">{validade}</strong>
                            </p>
                          ) : (
                            <p>Consulte as condições da oportunidade.</p>
                          )}
                          {cupom && codigoCopiado === oferta.id && (
                            <p className="mt-1 font-bold text-emerald-700">
                              Cupom copiado! Cole no carrinho da loja.
                            </p>
                          )}
                        </div>

                        {cupom && oferta.codigo ? (
                          <button
                            type="button"
                            onClick={() => usarCupom(oferta.id, oferta.codigo as string)}
                            className="w-full cursor-pointer rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] sm:w-auto sm:min-w-[220px]"
                          >
                            {codigoCopiado === oferta.id ? "✅ CUPOM COPIADO" : "🛒 USAR CUPOM"}
                          </button>
                        ) : (
                          <a
                            href={`/oferta/${oferta.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto sm:min-w-[220px]"
                          >
                            Ir para a oferta
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <footer className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="font-black">Achados do Casal</p>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            As condições podem mudar sem aviso prévio. Confira preço, validade,
            disponibilidade e regras antes de finalizar a compra. Alguns links podem
            ser de afiliados e gerar comissão para o Achados do Casal, sem custo extra
            para você.
          </p>
        </footer>
      </div>
    </main>
  );
}
