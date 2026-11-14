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
  regras: string | null;
  codigo: string | null;
  categoria: string | null;
  desconto_percentual: number | null;
  valor_desconto: number | null;
  pedido_minimo: number | null;
  validade: string | null;
  destaque: boolean;
  selos: string[];
  origem: string;
  parceiro_monetizado: boolean;
  verificado_em: string | null;
  created_at: string;
  updated_at: string;
  loja: Loja | null;
};

type RespostaCupons = {
  ofertas?: Cupom[];
  total?: number;
  error?: string;
};

type StatusRadar = {
  cuponsAtivos: number;
  lojasComCupons: number;
  novosUltimas24Horas: number;
  retiradosUltimas24Horas: number;
  maiorPercentual: number;
  maiorValor: number;
  ultimaVerificacao: string | null;
  proximaExecucao: string;
  frequenciaMinutos: number;
  atualizadoEm: string;
  error?: string;
};

type Ordenacao =
  | "relevancia"
  | "maior-desconto"
  | "recentes"
  | "vencimento";

type FiltroRapido =
  | "todos"
  | "verificados"
  | "vencendo"
  | "parceiros"
  | "radar";

type EstadoRelato = "enviando" | "enviado" | "erro";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarData(valor: string | null) {
  if (!valor) return "Consulte as condições";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Consulte as condições";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarHora(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tempoRelativo(valor: string | null | undefined) {
  if (!valor) return "sem horário registrado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "sem horário registrado";

  const diferenca = Math.max(0, Date.now() - data.getTime());
  const minutos = Math.floor(diferenca / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}

function formatarBeneficio(cupom: Cupom) {
  if (cupom.desconto_percentual !== null) {
    return `${Number(cupom.desconto_percentual).toLocaleString("pt-BR")}% OFF`;
  }
  if (cupom.valor_desconto !== null) {
    return `${MOEDA.format(Number(cupom.valor_desconto))} OFF`;
  }
  if (cupom.selos?.some((selo) => selo.toLowerCase().includes("frete"))) {
    return "Frete grátis";
  }
  return "Cupom ativo";
}

function dataValida(valor: string | null | undefined) {
  if (!valor) return null;
  const tempo = new Date(valor).getTime();
  return Number.isFinite(tempo) ? tempo : null;
}

function aconteceuNasUltimasHoras(
  valor: string | null | undefined,
  horas: number,
) {
  const tempo = dataValida(valor);
  if (tempo === null) return false;
  const diferenca = Date.now() - tempo;
  return diferenca >= 0 && diferenca <= horas * 60 * 60 * 1000;
}

function venceNasProximasHoras(cupom: Cupom, horas: number) {
  const validade = dataValida(cupom.validade);
  if (validade === null) return false;
  const diferenca = validade - Date.now();
  return diferenca > 0 && diferenca <= horas * 60 * 60 * 1000;
}

function beneficioParaOrdenacao(cupom: Cupom) {
  return (
    (Number(cupom.desconto_percentual) || 0) * 10_000 +
    (Number(cupom.valor_desconto) || 0)
  );
}

function textoPesquisa(cupom: Cupom) {
  return [
    cupom.titulo,
    cupom.descricao,
    cupom.regras,
    cupom.codigo,
    cupom.categoria,
    cupom.loja?.nome,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

export default function BlackFridayPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [statusRadar, setStatusRadar] = useState<StatusRadar | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [lojaSelecionada, setLojaSelecionada] = useState("todas");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("relevancia");
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [relatos, setRelatos] = useState<Record<string, EstadoRelato>>({});

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");

        const [respostaCupons, respostaStatus] = await Promise.all([
          fetch("/api/economize/ofertas?tipo=cupom", { cache: "no-store" }),
          fetch("/api/black-friday/status", { cache: "no-store" }),
        ]);

        const dadosCupons = (await respostaCupons.json()) as RespostaCupons;
        if (!respostaCupons.ok) {
          throw new Error(dadosCupons.error || "Falha ao carregar cupons.");
        }

        let dadosStatus: StatusRadar | null = null;
        if (respostaStatus.ok) {
          dadosStatus = (await respostaStatus.json()) as StatusRadar;
        }

        if (ativo) {
          setCupons(dadosCupons.ofertas ?? []);
          setStatusRadar(dadosStatus);
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
    return Array.from(mapa.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [cupons]);

  const categorias = useMemo(() => {
    return Array.from(
      new Set(
        cupons
          .map((cupom) => cupom.categoria?.trim())
          .filter((categoria): categoria is string => Boolean(categoria)),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cupons]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    const base = cupons.filter((cupom) => {
      if (termo && !textoPesquisa(cupom).includes(termo)) return false;
      if (
        lojaSelecionada !== "todas" &&
        cupom.loja?.slug !== lojaSelecionada
      ) {
        return false;
      }
      if (
        categoriaSelecionada !== "todas" &&
        cupom.categoria !== categoriaSelecionada
      ) {
        return false;
      }

      if (filtroRapido === "verificados") {
        return aconteceuNasUltimasHoras(
          cupom.verificado_em || cupom.updated_at,
          24,
        );
      }
      if (filtroRapido === "vencendo") {
        return venceNasProximasHoras(cupom, 48);
      }
      if (filtroRapido === "parceiros") {
        return cupom.parceiro_monetizado;
      }
      if (filtroRapido === "radar") {
        return cupom.origem === "black_friday_radar_2026";
      }

      return true;
    });

    return [...base].sort((a, b) => {
      if (ordenacao === "maior-desconto") {
        return beneficioParaOrdenacao(b) - beneficioParaOrdenacao(a);
      }

      if (ordenacao === "recentes") {
        return (
          (dataValida(b.verificado_em || b.updated_at) ?? 0) -
          (dataValida(a.verificado_em || a.updated_at) ?? 0)
        );
      }

      if (ordenacao === "vencimento") {
        const validadeA = dataValida(a.validade) ?? Number.MAX_SAFE_INTEGER;
        const validadeB = dataValida(b.validade) ?? Number.MAX_SAFE_INTEGER;
        return validadeA - validadeB;
      }

      const parceiroA = a.parceiro_monetizado ? 1 : 0;
      const parceiroB = b.parceiro_monetizado ? 1 : 0;
      if (parceiroA !== parceiroB) return parceiroB - parceiroA;

      const destaqueA = a.destaque ? 1 : 0;
      const destaqueB = b.destaque ? 1 : 0;
      if (destaqueA !== destaqueB) return destaqueB - destaqueA;

      const verificadoA = aconteceuNasUltimasHoras(
        a.verificado_em || a.updated_at,
        24,
      )
        ? 1
        : 0;
      const verificadoB = aconteceuNasUltimasHoras(
        b.verificado_em || b.updated_at,
        24,
      )
        ? 1
        : 0;
      if (verificadoA !== verificadoB) return verificadoB - verificadoA;

      return beneficioParaOrdenacao(b) - beneficioParaOrdenacao(a);
    });
  }, [
    busca,
    categoriaSelecionada,
    cupons,
    filtroRapido,
    lojaSelecionada,
    ordenacao,
  ]);

  const radar = cupons.filter(
    (cupom) => cupom.origem === "black_friday_radar_2026",
  );
  const parceiros = cupons.filter((cupom) => cupom.parceiro_monetizado);
  const haFiltros =
    busca.trim() !== "" ||
    lojaSelecionada !== "todas" ||
    categoriaSelecionada !== "todas" ||
    ordenacao !== "relevancia" ||
    filtroRapido !== "todos";

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

  async function reportar(cupom: Cupom) {
    if (relatos[cupom.id] === "enviando" || relatos[cupom.id] === "enviado") {
      return;
    }

    setRelatos((atual) => ({ ...atual, [cupom.id]: "enviando" }));

    try {
      const resposta = await fetch(
        `/api/economize/ofertas/${encodeURIComponent(cupom.id)}/reportar`,
        { method: "POST" },
      );
      if (!resposta.ok) throw new Error("Falha ao registrar aviso.");
      setRelatos((atual) => ({ ...atual, [cupom.id]: "enviado" }));
    } catch {
      setRelatos((atual) => ({ ...atual, [cupom.id]: "erro" }));
    }
  }

  function limparFiltros() {
    setBusca("");
    setLojaSelecionada("todas");
    setCategoriaSelecionada("todas");
    setOrdenacao("relevancia");
    setFiltroRapido("todos");
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
                Um radar que procura, valida, publica e retira cupons
                automaticamente — sem esconder quando uma oferta deixa de
                funcionar.
              </p>
            </div>

            <Link
              href="/"
              className="w-fit rounded-xl border border-white/20 bg-white/5 px-5 py-3 font-black text-white transition hover:bg-white/10"
            >
              Voltar ao início
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Cupons ativos
              </p>
              <p className="mt-2 text-3xl font-black">
                {statusRadar?.cuponsAtivos ?? cupons.length}
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-yellow-300">
                Lojas com cupom
              </p>
              <p className="mt-2 text-3xl font-black text-yellow-300">
                {statusRadar?.lojasComCupons ?? lojas.length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Novos em 24h
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-300">
                {statusRadar?.novosUltimas24Horas ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">
                Retirados em 24h
              </p>
              <p className="mt-2 text-3xl font-black text-red-300">
                {statusRadar?.retiradosUltimas24Horas ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-sky-300">
                Última verificação
              </p>
              <p className="mt-2 text-lg font-black text-sky-200">
                {tempoRelativo(statusRadar?.ultimaVerificacao)}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-violet-300">
                Próxima varredura
              </p>
              <p className="mt-2 text-lg font-black text-violet-200">
                {formatarHora(statusRadar?.proximaExecucao)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-zinc-400">
            <span>🔎 {radar.length} encontrados pelo radar</span>
            <span>💰 {parceiros.length} com monetização confirmada</span>
            {statusRadar && (
              <span>
                🏆 Até {statusRadar.maiorPercentual}% ou {MOEDA.format(statusRadar.maiorValor)} OFF
              </span>
            )}
            <span>🔁 Ronda automática a cada 3 horas</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-yellow-400">
                Busca inteligente
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {filtrados.length} cupom{filtrados.length === 1 ? "" : "s"} neste filtro
              </h2>
            </div>
            {haFiltros && (
              <button
                type="button"
                onClick={limparFiltros}
                className="w-fit text-sm font-black text-yellow-300 hover:text-yellow-200"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 md:col-span-2 xl:col-span-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Procurar
              </span>
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Loja, código, produto ou categoria..."
                className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white outline-none placeholder:text-zinc-600 focus:border-yellow-400"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Loja
              </span>
              <select
                value={lojaSelecionada}
                onChange={(event) => setLojaSelecionada(event.target.value)}
                className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 font-bold text-white outline-none focus:border-yellow-400"
              >
                <option value="todas">Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.slug}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Categoria
              </span>
              <select
                value={categoriaSelecionada}
                onChange={(event) =>
                  setCategoriaSelecionada(event.target.value)
                }
                className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 font-bold text-white outline-none focus:border-yellow-400"
              >
                <option value="todas">Todas as categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Ordenar
              </span>
              <select
                value={ordenacao}
                onChange={(event) =>
                  setOrdenacao(event.target.value as Ordenacao)
                }
                className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 font-bold text-white outline-none focus:border-yellow-400"
              >
                <option value="relevancia">Mais relevantes</option>
                <option value="maior-desconto">Maior desconto</option>
                <option value="recentes">Verificados recentemente</option>
                <option value="vencimento">Vencem primeiro</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ["todos", "Todos"],
              ["verificados", "✅ Verificados em 24h"],
              ["vencendo", "⏳ Vencendo em 48h"],
              ["parceiros", "💰 Só parceiros"],
              ["radar", "🔎 Descobertos pelo radar"],
            ].map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltroRapido(valor as FiltroRapido)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                  filtroRapido === valor
                    ? "bg-yellow-400 text-black"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:border-yellow-400/60"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {carregando ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-10 text-center text-zinc-400">
            Carregando cupons e status do radar...
          </div>
        ) : erro ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 font-bold text-red-300">
            {erro}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-zinc-950 p-10 text-center">
            <p className="text-4xl">🏷️</p>
            <h2 className="mt-4 text-xl font-black">
              Nenhum cupom neste filtro
            </h2>
            <p className="mt-2 text-zinc-400">
              Altere os filtros. O radar continua procurando novas oportunidades.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((cupom) => {
              const ehRadar =
                cupom.origem === "black_friday_radar_2026";
              const validade = formatarData(cupom.validade);
              const beneficio = formatarBeneficio(cupom);
              const relato = relatos[cupom.id];

              return (
                <article
                  key={cupom.id}
                  className="flex flex-col rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-lg transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase tracking-wider text-zinc-400">
                        {cupom.loja?.nome || "Loja"}
                        {cupom.categoria ? ` · ${cupom.categoria}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cupom.parceiro_monetizado ? (
                          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300">
                            💰 Parceiro monetizado
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-black">
                            🔎 Radar verificado
                          </span>
                        )}
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

                  <p className="mt-4 text-xs font-bold text-sky-300">
                    ✅ Verificado {tempoRelativo(cupom.verificado_em || cupom.updated_at)}
                  </p>

                  <h3 className="mt-2 line-clamp-3 text-xl font-black leading-7">
                    {cupom.titulo}
                  </h3>

                  {cupom.descricao && (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
                      {cupom.descricao}
                    </p>
                  )}

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
                        {copiado === cupom.id
                          ? "✅ Copiado!"
                          : "Clique para copiar"}
                      </span>
                    </button>
                  )}

                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    <p>
                      ⏱️ Validade:{" "}
                      <strong className="text-zinc-200">{validade}</strong>
                    </p>
                    {cupom.pedido_minimo !== null && (
                      <p>
                        🛒 Pedido mínimo:{" "}
                        <strong className="text-zinc-200">
                          {MOEDA.format(Number(cupom.pedido_minimo))}
                        </strong>
                      </p>
                    )}
                    {venceNasProximasHoras(cupom, 48) && (
                      <p className="font-black text-orange-300">
                        ⚠️ Este cupom vence em breve
                      </p>
                    )}
                  </div>

                  {cupom.regras && (
                    <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                      <summary className="cursor-pointer font-black text-zinc-200">
                        Ver condições
                      </summary>
                      <p className="mt-2 leading-6">{cupom.regras}</p>
                    </details>
                  )}

                  <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-[1fr_auto]">
                    <a
                      href={`/oferta/${cupom.id}?origem=black_friday`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void copiar(cupom)}
                      className="rounded-xl bg-yellow-400 px-5 py-3.5 text-center font-black uppercase tracking-wide text-black transition hover:bg-yellow-300"
                    >
                      {copiado === cupom.id
                        ? "✅ Copiado · Ir para a loja"
                        : "Usar cupom"}
                    </a>
                    <button
                      type="button"
                      onClick={() => void reportar(cupom)}
                      disabled={relato === "enviando" || relato === "enviado"}
                      className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-400 transition hover:border-red-400/60 hover:text-red-300 disabled:cursor-default disabled:opacity-80"
                    >
                      {relato === "enviando"
                        ? "Enviando..."
                        : relato === "enviado"
                          ? "✅ Aviso recebido"
                          : relato === "erro"
                            ? "Tentar novamente"
                            : "Não funcionou"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-5 text-sm leading-6 text-zinc-400">
          <p className="font-black text-zinc-200">Como funciona o radar</p>
          <p className="mt-2">
            Cupons de marcas sem parceria podem aparecer quando são úteis para
            o público. Os identificados como “parceiro monetizado” utilizam uma
            integração ou link de afiliado válido. O botão “Não funcionou” cria
            um alerta para revalidação.
          </p>
        </div>
      </section>
    </main>
  );
}
