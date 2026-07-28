"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NovaOportunidadeModal from "./NovaOportunidadeModal";
import EditarOportunidadeModal from "./EditarOportunidadeModal";


type LojaEconomize = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
  ativa: boolean;
  ordem: number;
};

type RespostaLojas = {
  lojas?: LojaEconomize[];
  error?: string;
};
type LojaDaOferta = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
};

type OfertaEconomize = {
  id: string;
  loja_id: string;
  tipo:
    | "cupom"
    | "cashback"
    | "promocao"
    | "campanha"
    | "frete_gratis";
  status:
    | "pendente"
    | "ativo"
    | "expirado"
    | "inativo"
    | "erro";
  titulo: string;
  descricao: string | null;
  codigo: string | null;
  categoria: string | null;
  regras: string | null;
  imagem_url: string | null;
  link_destino: string;
  link_afiliado: string | null;
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
  origem_url: string | null;
  created_at: string;
  updated_at: string;
  loja: LojaDaOferta | null;
};

type RespostaOfertas = {
  ofertas?: OfertaEconomize[];
  error?: string;
};
const rotulosTipo: Record<
  OfertaEconomize["tipo"],
  string
> = {
  cupom: "Cupom",
  cashback: "Cashback",
  promocao: "Promoção",
  campanha: "Campanha",
  frete_gratis: "Frete grátis",
};

const iconesTipo: Record<
  OfertaEconomize["tipo"],
  string
> = {
  cupom: "🏷️",
  cashback: "💵",
  promocao: "🔥",
  campanha: "🎁",
  frete_gratis: "📦",
};

const rotulosStatus: Record<
  OfertaEconomize["status"],
  string
> = {
  pendente: "Pendente",
  ativo: "Ativo",
  expirado: "Expirado",
  inativo: "Inativo",
  erro: "Erro",
};

function formatarMoeda(valor: number | null) {
  if (valor === null) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(valor: string | null) {
  if (!valor) {
    return null;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
const tiposEconomize = [
  {
    valor: "todos",
    rotulo: "Todos os tipos",
  },
  {
    valor: "cupom",
    rotulo: "Cupons",
  },
  {
    valor: "cashback",
    rotulo: "Cashback",
  },
  {
    valor: "promocao",
    rotulo: "Promoções",
  },
  {
    valor: "campanha",
    rotulo: "Campanhas",
  },
  {
    valor: "frete_gratis",
    rotulo: "Frete grátis",
  },
];

const indicadores = [
  {
    titulo: "Oportunidades",
    valor: 0,
    icone: "💰",
  },
  {
    titulo: "Cupons",
    valor: 0,
    icone: "🏷️",
  },
  {
    titulo: "Cashback",
    valor: 0,
    icone: "💵",
  },
  {
    titulo: "Promoções",
    valor: 0,
    icone: "🔥",
  },
  {
    titulo: "Campanhas",
    valor: 0,
    icone: "🎁",
  },
];

export default function AdminEconomizePage() {
  const [lojas, setLojas] = useState<LojaEconomize[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [lojaSelecionada, setLojaSelecionada] =
    useState("todas");
  const [tipoSelecionado, setTipoSelecionado] =
    useState("todos");
      const [modalAberto, setModalAberto] = useState(false);
      const [ofertaEmEdicao, setOfertaEmEdicao] =
  useState<OfertaEconomize | null>(null);
      const [ofertas, setOfertas] = useState<OfertaEconomize[]>([]);
const [carregandoOfertas, setCarregandoOfertas] =
  useState(true);
const [erroOfertas, setErroOfertas] = useState("");
const [atualizacaoOfertas, setAtualizacaoOfertas] =
  useState(0);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarLojas() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          "/api/admin/economize/lojas",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          (await resposta.json()) as RespostaLojas;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ||
              "Não foi possível carregar as lojas."
          );
        }

        if (componenteAtivo) {
          setLojas(resultado.lojas ?? []);
        }
      } catch (error) {
        console.error(
          "Erro ao carregar lojas da Central Economize:",
          error
        );

        if (componenteAtivo) {
          setErro(
            error instanceof Error
              ? error.message
              : "Erro inesperado ao carregar as lojas."
          );
        }
      } finally {
        if (componenteAtivo) {
          setCarregando(false);
        }
      }
    }

    carregarLojas();

    return () => {
      componenteAtivo = false;
    };
  }, []);
useEffect(() => {
  let componenteAtivo = true;

  async function carregarOfertas() {
    try {
      setCarregandoOfertas(true);
      setErroOfertas("");

      const resposta = await fetch(
        "/api/admin/economize/ofertas",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const resultado =
        (await resposta.json()) as RespostaOfertas;

      if (!resposta.ok) {
        throw new Error(
          resultado.error ||
            "Não foi possível carregar as oportunidades."
        );
      }

      if (componenteAtivo) {
        setOfertas(resultado.ofertas ?? []);
      }
    } catch (error) {
      console.error(
        "Erro ao carregar oportunidades:",
        error
      );

      if (componenteAtivo) {
        setErroOfertas(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar oportunidades."
        );
      }
    } finally {
      if (componenteAtivo) {
        setCarregandoOfertas(false);
      }
    }
  }

  carregarOfertas();

  return () => {
    componenteAtivo = false;
  };
}, [atualizacaoOfertas]);

  const lojasAtivas = useMemo(
    
    () =>
      lojas
        .filter((loja) => loja.ativa)
        .sort((a, b) => a.ordem - b.ordem),
    [lojas]
  );
    
  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter((oferta) => {
      const correspondeLoja =
        lojaSelecionada === "todas" ||
        oferta.loja?.slug === lojaSelecionada;

      const correspondeTipo =
        tipoSelecionado === "todos" ||
        oferta.tipo === tipoSelecionado;

      return correspondeLoja && correspondeTipo;
    });
  }, [ofertas, lojaSelecionada, tipoSelecionado]);

  const indicadoresReais = useMemo(
    () => [
      {
        titulo: "Oportunidades",
        valor: ofertas.length,
        icone: "💰",
      },
      {
        titulo: "Cupons",
        valor: ofertas.filter(
          (oferta) => oferta.tipo === "cupom"
        ).length,
        icone: "🏷️",
      },
      {
        titulo: "Cashback",
        valor: ofertas.filter(
          (oferta) => oferta.tipo === "cashback"
        ).length,
        icone: "💵",
      },
      {
        titulo: "Promoções",
        valor: ofertas.filter(
          (oferta) => oferta.tipo === "promocao"
        ).length,
        icone: "🔥",
      },
      {
        titulo: "Campanhas",
        valor: ofertas.filter(
          (oferta) => oferta.tipo === "campanha"
        ).length,
        icone: "🎁",
      },
    ],
    [ofertas]
  );

    return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
              Achados do Casal
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              💰 Central Economize
            </h1>

            <p className="mt-2 max-w-2xl text-slate-600">
              Gerencie cupons, cashback, promoções, campanhas
              e benefícios encontrados pelo Agente de
              Economia.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
            >
              📦 Produtos
            </Link>

            <Link
              href="/admin/monitor"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
            >
              📈 Monitor
            </Link>

            <button
  type="button"
  onClick={() => setModalAberto(true)}
  disabled={carregando || lojasAtivas.length === 0}
  className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  + Nova oportunidade
</button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {indicadoresReais.map((indicador) => (
            <div
              key={indicador.titulo}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-500">
                  {indicador.titulo}
                </p>

                <span className="text-2xl">
                  {indicador.icone}
                </span>
              </div>

              <p className="mt-3 text-3xl font-black text-slate-950">
                {indicador.valor}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">
                Oportunidades cadastradas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
  {ofertasFiltradas.length} oportunidade(s)
  encontrada(s) com os filtros selecionados.
</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">
                  Loja
                </span>

                <select
                  value={lojaSelecionada}
                  onChange={(event) =>
                    setLojaSelecionada(event.target.value)
                  }
                  className="min-w-56 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                >
                  <option value="todas">
                    Todas as lojas
                  </option>

                  {lojasAtivas.map((loja) => (
                    <option
                      key={loja.id}
                      value={loja.slug}
                    >
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-600">
                  Tipo
                </span>

                <select
                  value={tipoSelecionado}
                  onChange={(event) =>
                    setTipoSelecionado(event.target.value)
                  }
                  className="min-w-56 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                >
                  {tiposEconomize.map((tipo) => (
                    <option
                      key={tipo.valor}
                      value={tipo.valor}
                    >
                      {tipo.rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {carregando ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="font-bold text-slate-700">
                Carregando lojas da Central Economize...
              </p>
            </div>
          ) : erro ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
              <p className="font-black text-red-700">
                Não foi possível carregar a Central
                Economize.
              </p>

              <p className="mt-2 text-sm text-red-600">
                {erro}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-red-600 px-4 py-3 font-black text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {carregandoOfertas ? (
  <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
    <p className="font-bold text-slate-700">
      Carregando oportunidades...
    </p>
  </div>
) : erroOfertas ? (
  <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
    <p className="font-black text-red-700">
      Não foi possível carregar as oportunidades.
    </p>

    <p className="mt-2 text-sm text-red-600">
      {erroOfertas}
    </p>

    <button
      type="button"
      onClick={() =>
        setAtualizacaoOfertas(
          (valorAtual) => valorAtual + 1
        )
      }
      className="mt-4 rounded-xl bg-red-600 px-4 py-3 font-black text-white"
    >
      Tentar novamente
    </button>
  </div>
) : ofertasFiltradas.length === 0 ? (
  <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
    <div className="text-5xl">💰</div>

    <h3 className="mt-4 text-xl font-black">
      Nenhuma oportunidade encontrada
    </h3>

    <p className="mx-auto mt-2 max-w-xl text-slate-500">
      Não existem oportunidades correspondentes aos filtros
      selecionados.
    </p>
  </div>
) : (
  <div className="mt-8 grid gap-4 lg:grid-cols-2">
    {ofertasFiltradas.map((oferta) => {
      const validadeFormatada = formatarData(
        oferta.validade
      );

      const precoOriginalFormatado = formatarMoeda(
        oferta.preco_original
      );

      const precoOfertaFormatado = formatarMoeda(
        oferta.preco_oferta
      );

      const valorDescontoFormatado = formatarMoeda(
        oferta.valor_desconto
      );

      return (
        <article
          key={oferta.id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {iconesTipo[oferta.tipo]}
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  {rotulosTipo[oferta.tipo]}
                </p>

                <p className="text-sm font-bold text-slate-500">
                  {oferta.loja?.nome || "Loja não informada"}
                </p>
              </div>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                oferta.status === "ativo"
                  ? "bg-emerald-100 text-emerald-700"
                  : oferta.status === "pendente"
                    ? "bg-amber-100 text-amber-700"
                    : oferta.status === "erro"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-200 text-slate-700"
              }`}
            >
              {rotulosStatus[oferta.status]}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-black text-slate-950">
            {oferta.titulo}
          </h3>

          {oferta.descricao && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {oferta.descricao}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {oferta.categoria && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {oferta.categoria}
              </span>
            )}

            {oferta.destaque && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                ⭐ Destaque
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

          {oferta.codigo && (
            <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Código do cupom
              </p>

              <p className="mt-1 text-xl font-black text-emerald-900">
                {oferta.codigo}
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {oferta.desconto_percentual !== null && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">
                  Desconto
                </p>

                <p className="mt-1 font-black">
                  {oferta.desconto_percentual}%
                </p>
              </div>
            )}

            {valorDescontoFormatado && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">
                  Economia
                </p>

                <p className="mt-1 font-black">
                  {valorDescontoFormatado}
                </p>
              </div>
            )}

            {oferta.cashback_percentual !== null && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">
                  Cashback
                </p>

                <p className="mt-1 font-black">
                  {oferta.cashback_percentual}%
                </p>
              </div>
            )}

            {precoOfertaFormatado && (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">
                  Preço da oferta
                </p>

                <p className="mt-1 font-black text-emerald-700">
                  {precoOfertaFormatado}
                </p>

                {precoOriginalFormatado && (
                  <p className="mt-1 text-xs text-slate-400 line-through">
                    {precoOriginalFormatado}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {validadeFormatada ? (
                <p>
                  Válido até{" "}
                  <strong className="text-slate-700">
                    {validadeFormatada}
                  </strong>
                </p>
              ) : (
                <p>Validade não informada</p>
              )}
            </div>
<div className="flex flex-col gap-2 sm:flex-row">
  <button
    type="button"
    onClick={() => setOfertaEmEdicao(oferta)}
    className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-black text-white transition hover:bg-blue-700"
  >
    Editar
  </button>

  <a
    href={oferta.link_destino}
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-black text-slate-700 transition hover:bg-slate-100"
  >
    Abrir destino
  </a>
</div>
           
          </div>
        </article>
      );
    })}
  </div>
)}

              <div className="mt-8 border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black text-slate-900">
                      Lojas conectadas
                    </h3>

                    <p className="text-sm text-slate-500">
                      {lojasAtivas.length} loja(s) disponível(is)
                      para a Central Economize.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">
                    Banco conectado
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {lojasAtivas.map((loja) => (
                    <span
                      key={loja.id}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                    >
                      {loja.nome}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
                  </section>
      </div>

      <NovaOportunidadeModal
        aberto={modalAberto}
        lojas={lojasAtivas}
        aoFechar={() => setModalAberto(false)}
        aoCadastrar={() => {
  setModalAberto(false);
  setAtualizacaoOfertas((valorAtual) => valorAtual + 1);
}}
      />
      <NovaOportunidadeModal
  aberto={modalAberto}
  lojas={lojasAtivas}
  aoFechar={() => setModalAberto(false)}
  aoCadastrar={() => {
    setModalAberto(false);
    setAtualizacaoOfertas(
      (valorAtual) => valorAtual + 1
    );
  }}
/>

<EditarOportunidadeModal
  aberto={ofertaEmEdicao !== null}
  oferta={ofertaEmEdicao}
  lojas={lojasAtivas}
  aoFechar={() => setOfertaEmEdicao(null)}
  aoAtualizar={() => {
    setOfertaEmEdicao(null);
    setAtualizacaoOfertas(
      (valorAtual) => valorAtual + 1
    );
  }}
/>
    </main>
  );
}