"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Loja = {
  id: string;
  nome: string;
  slug: string;
};

type Cupom = {
  id: string;
  titulo: string;
  descricao: string | null;
  codigo: string | null;
  desconto_percentual: number | null;
  valor_desconto: number | null;
  pedido_minimo: number | null;
  validade: string | null;
  destaque: boolean;
  selos: string[];
  origem: string;
  updated_at: string;
  loja: Loja | null;
};

type Resposta = {
  ofertas?: Cupom[];
  total?: number;
  error?: string;
};

function formatarData(valor: string | null) {
  if (!valor) return "Consulte as condições";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Consulte as condições";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarBeneficio(cupom: Cupom) {
  if (cupom.desconto_percentual !== null) {
    return `${Number(cupom.desconto_percentual).toLocaleString("pt-BR")}% OFF`;
  }
  if (cupom.valor_desconto !== null) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(cupom.valor_desconto)) + " OFF";
  }
  if (cupom.selos?.some((s) => s.toLowerCase().includes("frete"))) {
    return "Frete grátis";
  }
  return "Cupom ativo";
}

export default function BlackFridayPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState("todas");
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch("/api/economize/ofertas?tipo=cupom", {
          cache: "no-store",
        });
        const dados = (await resposta.json()) as Resposta;
        if (!resposta.ok) {
          throw new Error(dados.error || "Falha ao carregar cupons.");
        }

        if (ativo) {
          setCupons(
            (dados.ofertas ?? []).sort((a, b) => {
              const radarA = a.origem === "black_friday_radar_2026" ? 1 : 0;
              const radarB = b.origem === "black_friday_radar_2026" ? 1 : 0;
              if (radarA !== radarB) return radarB - radarA;

              const destaqueA = a.destaque ? 1 : 0;
              const destaqueB = b.destaque ? 1 : 0;
              if (destaqueA !== destaqueB) return destaqueB - destaqueA;

              const descA = Number(a.desconto_percentual || 0);
              const descB = Number(b.desconto_percentual || 0);
              if (descA !== descB) return descB - descA;

              return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            })
          );
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Erro inesperado.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const lojas = useMemo(() => {
    const mapa = new Map<string, Loja>();
    cupons.forEach((cupom) => {
      if (cupom.loja) mapa.set(cupom.loja.slug, cupom.loja);
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [cupons]);

  const filtrados = useMemo(
    () =>
      cupons.filter(
        (cupom) =>
          lojaSelecionada === "todas" || cupom.loja?.slug === lojaSelecionada
      ),
    [cupons, lojaSelecionada]
  );

  const radar = cupons.filter((cupom) => cupom.origem === "black_friday_radar_2026");
  const parceiros = cupons.length - radar.length;

  async function copiar(cupom: Cupom) {
    if (!cupom.codigo) return;
    try {
      await navigator.clipboard.writeText(cupom.codigo);
      setCopiado(cupom.id);
      window.setTimeout(() => {
        setCopiado((atual) => (atual === cupom.id ? null : atual));
      }, 2500);
    } catch {
      // O clique para a oferta continua funcionando mesmo se o clipboard falhar.
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-gradient-to-br from-black via-zinc-950 to-zinc-900">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-400">
                Achados do Casal · Black Friday 2026
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
                🖤 Central de Cupons Black Friday
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Cupons parceiros e cupons encontrados pelo nosso radar. Só entram automaticamente
                quando há benefício relevante, validade aceitável e sinal recente de uso.
              </p>
            </div>

            <Link
              href="/"
              className="w-fit rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-black text-white transition hover:bg-white/10"
            >
              Voltar ao início
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Cupons ativos</p>
              <p className="mt-2 text-3xl font-black">{cupons.length}</p>
            </div>
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-yellow-300">Radar Black Friday</p>
              <p className="mt-2 text-3xl font-black text-yellow-300">{radar.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Parceiros</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{parceiros}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-yellow-400">Filtrar</p>
              <h2 className="mt-1 text-2xl font-black">Cupons disponíveis agora</h2>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-zinc-400">Loja</span>
              <select
                value={lojaSelecionada}
                onChange={(event) => setLojaSelecionada(event.target.value)}
                className="min-w-64 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 font-bold text-white outline-none focus:border-yellow-400"
              >
                <option value="todas">Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.slug}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {carregando ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-10 text-center text-zinc-400">
            Carregando cupons...
          </div>
        ) : erro ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 font-bold text-red-300">
            {erro}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-zinc-950 p-10 text-center">
            <p className="text-4xl">🏷️</p>
            <h2 className="mt-4 text-xl font-black">Nenhum cupom neste filtro</h2>
            <p className="mt-2 text-zinc-400">O radar continua procurando novas oportunidades.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((cupom) => {
              const ehRadar = cupom.origem === "black_friday_radar_2026";
              const validade = formatarData(cupom.validade);
              const beneficio = formatarBeneficio(cupom);

              return (
                <article
                  key={cupom.id}
                  className="flex flex-col rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                        {cupom.loja?.nome || "Loja"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            ehRadar
                              ? "bg-yellow-400 text-black"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {ehRadar ? "🔎 Radar verificado" : "🤝 Parceiro"}
                        </span>
                        {cupom.destaque && (
                          <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-black text-fuchsia-300">
                            ⭐ Destaque
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-sm font-black text-black">
                      {beneficio}
                    </span>
                  </div>

                  <h3 className="mt-4 line-clamp-3 text-xl font-black leading-7">
                    {cupom.titulo}
                  </h3>

                  {cupom.codigo && (
                    <button
                      type="button"
                      onClick={() => void copiar(cupom)}
                      className="mt-5 rounded-2xl border-2 border-dashed border-yellow-400 bg-yellow-400/10 px-4 py-4 text-center transition hover:bg-yellow-400/15"
                    >
                      <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-yellow-300">
                        Código do cupom
                      </span>
                      <span className="mt-1 block break-all text-2xl font-black text-yellow-300">
                        {cupom.codigo}
                      </span>
                      <span className="mt-2 block text-xs font-bold text-zinc-400">
                        {copiado === cupom.id ? "✅ Copiado!" : "Clique para copiar"}
                      </span>
                    </button>
                  )}

                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    <p>
                      ⏱️ Validade: <strong className="text-zinc-200">{validade}</strong>
                    </p>
                    {cupom.pedido_minimo !== null && (
                      <p>
                        🛒 Pedido mínimo:{" "}
                        <strong className="text-zinc-200">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(Number(cupom.pedido_minimo))}
                        </strong>
                      </p>
                    )}
                    {ehRadar && (
                      <p className="text-xs leading-5 text-zinc-500">
                        Cupom descoberto por fonte pública com sinal recente de uso. Confirme a condição final no carrinho.
                      </p>
                    )}
                  </div>

                  <a
                    href={`/oferta/${cupom.id}?origem=black_friday`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void copiar(cupom)}
                    className="mt-auto pt-5"
                  >
                    <span className="block w-full rounded-xl bg-yellow-400 px-5 py-3.5 text-center font-black uppercase tracking-wide text-black transition hover:bg-yellow-300">
                      {copiado === cupom.id ? "✅ Cupom copiado · Ir para a loja" : "Usar cupom"}
                    </span>
                  </a>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400">
          <p className="font-black text-zinc-200">Como funciona o radar</p>
          <p className="mt-2">
            Cupons de lojas sem parceria podem aparecer para ajudar você a economizar e para ampliar nossa cobertura.
            Quando não existe link de afiliado, o clique vai direto para a loja. A presença na página não significa parceria comercial.
          </p>
        </div>
      </section>
    </main>
  );
}
