"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ProdutoDestaque = {
  id: number;
  nome: string;
  loja: string;
  categoria: string;
  precoAnterior?: number;
  precoAtual: number;
  pagamento: string;
  link: string;
  imagem: string;
};

type HeroDestaqueProps = {
  produtos: ProdutoDestaque[];
  carregando?: boolean;
  intervaloMs?: number;
};

function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularEconomia(precoAnterior?: number, precoAtual?: number) {
  if (!precoAnterior || !precoAtual || precoAnterior <= precoAtual) {
    return null;
  }

  return precoAnterior - precoAtual;
}

export default function HeroDestaque({
  produtos,
  carregando = false,
  intervaloMs = 6000,
}: HeroDestaqueProps) {
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [autoAtivo, setAutoAtivo] = useState(true);
  const [interacaoAtiva, setInteracaoAtiva] = useState(false);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const toqueInicioX = useRef<number | null>(null);
  const total = produtos.length;

  useEffect(() => {
    setIndiceAtual((indice) => {
      if (total === 0) return 0;
      return Math.min(indice, total - 1);
    });
  }, [total]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => setReduzirMovimento(media.matches);

    atualizar();
    media.addEventListener?.("change", atualizar);
    return () => media.removeEventListener?.("change", atualizar);
  }, []);

  const irPara = useCallback((indice: number) => {
    if (total <= 0) return;
    setIndiceAtual((indice + total) % total);
  }, [total]);

  const anterior = useCallback(() => {
    setIndiceAtual((indice) => total > 0 ? (indice - 1 + total) % total : 0);
  }, [total]);

  const proximo = useCallback(() => {
    setIndiceAtual((indice) => total > 0 ? (indice + 1) % total : 0);
  }, [total]);

  useEffect(() => {
    if (
      total <= 1 ||
      !autoAtivo ||
      interacaoAtiva ||
      reduzirMovimento
    ) {
      return;
    }

    const temporizador = window.setInterval(proximo, intervaloMs);
    return () => window.clearInterval(temporizador);
  }, [
    autoAtivo,
    interacaoAtiva,
    intervaloMs,
    proximo,
    reduzirMovimento,
    total,
  ]);

  if (carregando) {
    return (
      <div className="rounded-3xl bg-white p-7 text-center text-slate-500 shadow-2xl">
        Carregando ofertas em destaque...
      </div>
    );
  }

  const produto = produtos[indiceAtual] ?? produtos[0];

  if (!produto) {
    return (
      <div className="rounded-3xl bg-white p-7 text-center text-slate-500 shadow-2xl">
        Nenhuma oferta em destaque disponível no momento.
      </div>
    );
  }

  const economia = calcularEconomia(
    produto.precoAnterior,
    produto.precoAtual,
  );

  function iniciarToque(evento: React.TouchEvent<HTMLDivElement>) {
    toqueInicioX.current = evento.touches[0]?.clientX ?? null;
    setInteracaoAtiva(true);
  }

  function finalizarToque(evento: React.TouchEvent<HTMLDivElement>) {
    const inicio = toqueInicioX.current;
    const fim = evento.changedTouches[0]?.clientX ?? null;
    toqueInicioX.current = null;
    setInteracaoAtiva(false);

    if (inicio === null || fim === null) return;
    const deslocamento = fim - inicio;
    if (Math.abs(deslocamento) < 45) return;

    if (deslocamento > 0) anterior();
    else proximo();
  }

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Ofertas em destaque"
      tabIndex={0}
      onKeyDown={(evento) => {
        if (evento.key === "ArrowLeft") {
          evento.preventDefault();
          anterior();
        }
        if (evento.key === "ArrowRight") {
          evento.preventDefault();
          proximo();
        }
      }}
      onMouseEnter={() => setInteracaoAtiva(true)}
      onMouseLeave={() => setInteracaoAtiva(false)}
      onFocusCapture={() => setInteracaoAtiva(true)}
      onBlurCapture={() => setInteracaoAtiva(false)}
      onTouchStart={iniciarToque}
      onTouchEnd={finalizarToque}
      className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl outline-none ring-pink-300 transition focus-visible:ring-4"
    >
      <div
        key={produto.id}
        className="grid md:grid-cols-[220px_1fr]"
        style={reduzirMovimento ? undefined : {
          animation: "heroDestaqueEntrada 360ms ease-out",
        }}
      >
        <div className="relative flex min-h-56 items-center justify-center bg-slate-50 p-6">
          {total > 1 && (
            <span className="absolute left-4 top-4 rounded-full bg-blue-950 px-3 py-1 text-xs font-black text-white shadow">
              {indiceAtual + 1} de {total}
            </span>
          )}

          <img
            src={produto.imagem}
            alt={produto.nome}
            className="h-52 w-full object-contain"
          />
        </div>

        <div className="p-7">
          <span className="inline-flex rounded-full bg-pink-100 px-3 py-1 text-xs font-black uppercase text-pink-600">
            Achado em destaque
          </span>

          <h2 className="mt-5 text-2xl font-black">
            {produto.nome}
          </h2>

          <p className="mt-2 text-slate-500">
            {produto.categoria} — {produto.loja}
          </p>

          {produto.precoAnterior && (
            <div className="mt-5 text-sm text-slate-400 line-through">
              De {formatarPreco(produto.precoAnterior)}
            </div>
          )}

          <div className="text-4xl font-black text-pink-500">
            {formatarPreco(produto.precoAtual)}
          </div>

          {economia && (
            <p className="mt-2 font-bold text-green-700">
              Economia de {formatarPreco(economia)}
            </p>
          )}

          {produto.pagamento && (
            <p className="mt-2 font-bold text-green-700">
              {produto.pagamento}
            </p>
          )}

          <a
            href={`/produto/${produto.id}/ir?origem=site`}
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-blue-950 px-5 py-4 font-black text-white transition hover:bg-blue-900"
          >
            Ver oferta na {produto.loja}
          </a>
        </div>
      </div>

      {total > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={anterior}
            aria-label="Ver oferta anterior"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl font-black text-blue-950 transition hover:border-pink-400 hover:bg-pink-50"
          >
            ‹
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2" aria-label="Selecionar oferta em destaque">
            {produtos.map((item, indice) => (
              <button
                key={item.id}
                type="button"
                onClick={() => irPara(indice)}
                aria-label={`Ver oferta ${indice + 1}: ${item.nome}`}
                aria-current={indice === indiceAtual ? "true" : undefined}
                className={`h-2.5 rounded-full transition-all ${
                  indice === indiceAtual
                    ? "w-8 bg-pink-500"
                    : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAutoAtivo((ativo) => !ativo)}
            aria-label={autoAtivo ? "Pausar troca automática" : "Retomar troca automática"}
            className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm font-black text-blue-950 transition hover:border-pink-400 hover:bg-pink-50"
          >
            {autoAtivo ? "Ⅱ" : "▶"}
          </button>

          <button
            type="button"
            onClick={proximo}
            aria-label="Ver próxima oferta"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl font-black text-blue-950 transition hover:border-pink-400 hover:bg-pink-50"
          >
            ›
          </button>
        </div>
      )}

      <style>{`
        @keyframes heroDestaqueEntrada {
          from {
            opacity: 0.35;
            transform: translateX(14px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
