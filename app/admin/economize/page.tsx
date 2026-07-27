"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NovaOportunidadeModal from "./NovaOportunidadeModal";


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

  const lojasAtivas = useMemo(
    () =>
      lojas
        .filter((loja) => loja.ativa)
        .sort((a, b) => a.ordem - b.ordem),
    [lojas]
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
          {indicadores.map((indicador) => (
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
                Consulte e organize os benefícios publicados
                na Central Economize.
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
              <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <div className="text-5xl">💰</div>

                <h3 className="mt-4 text-xl font-black">
                  Nenhuma oportunidade cadastrada ainda
                </h3>

                <p className="mx-auto mt-2 max-w-xl text-slate-500">
                  No próximo passo criaremos o formulário
                  para cadastrar o primeiro cupom, cashback,
                  promoção ou campanha.
                </p>
              </div>

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
        aoCadastrar={() => setModalAberto(false)}
      />
    </main>
  );
}