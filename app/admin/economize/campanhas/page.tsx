"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ItemCampanha = {
  chave: string;
  tipo: "produto" | "oferta";
  titulo: string;
  loja: string;
  preco: number | null;
  quantidade: number;
};

type PerfilCampanha = {
  codigo: string;
  nome: string;
  content: string;
  link: string;
  visitas: number;
  sessoes: number;
  cliques: number;
  sessoesComClique: number;
  conversao: number;
  cliquesReview: number;
  cliquesProdutos: number;
  cliquesOfertas: number;
  variacaoVisitas: number;
  variacaoCliques: number;
  topItens: ItemCampanha[];
};

type RespostaCampanhas = {
  campanha: {
    id: string;
    nome: string;
    source: string;
    medium: string;
    atribuicaoDias: number;
  };
  periodo: { dias: number; inicio: string; fim: string };
  resumo: {
    visitas: number;
    sessoes: number;
    cliques: number;
    sessoesComClique: number;
    conversao: number;
    cliquesReview: number;
    cliquesProdutos: number;
    cliquesOfertas: number;
    variacaoVisitas: number;
    variacaoCliques: number;
  };
  diagnostico: {
    humanos: number;
    bots: number;
    internos: number;
    naoClassificados: number;
    bruto: number;
  };
  perfis: PerfilCampanha[];
  atualizadoEm: string;
  error?: string;
};

const CORES: Record<string, string> = {
  "black-gabriel": "from-blue-700 to-indigo-900",
  "black-bruna": "from-fuchsia-600 to-pink-700",
  "black-achados": "from-amber-500 to-orange-700",
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function variacao(valor: number) {
  if (!Number.isFinite(valor)) return "0%";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toFixed(1).replace(".0", "")}%`;
}

async function copiarTexto(texto: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  document.execCommand("copy");
  campo.remove();
}

export default function CampanhasPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<RespostaCampanhas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch(
          `/api/admin/economize/campanhas?dias=${dias}`,
          { cache: "no-store" },
        );
        const resultado = (await resposta.json()) as RespostaCampanhas;
        if (!resposta.ok) {
          throw new Error(resultado.error || "Não foi possível carregar a campanha.");
        }
        if (ativo) setDados(resultado);
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
  }, [dias]);

  async function copiar(perfil: PerfilCampanha) {
    try {
      await copiarTexto(perfil.link);
      setCopiado(perfil.codigo);
      window.setTimeout(() => setCopiado(""), 1800);
    } catch {
      setErro("Não foi possível copiar o link automaticamente.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
                Divulgação mensurável
              </p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">
                📣 Campanhas dos Instagrams
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                Cada perfil possui um link exclusivo para a Central Black Friday.
                O painel separa visitas humanas, sessões, cliques em ofertas,
                produtos e reviews para mostrar qual audiência trouxe mais demanda.
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

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              titulo: "Visitas humanas",
              valor: dados?.resumo.visitas ?? 0,
              detalhe: dados ? variacao(dados.resumo.variacaoVisitas) : "—",
            },
            {
              titulo: "Pessoas / sessões",
              valor: dados?.resumo.sessoes ?? 0,
              detalhe: "audiência identificada",
            },
            {
              titulo: "Cliques gerados",
              valor: dados?.resumo.cliques ?? 0,
              detalhe: dados ? variacao(dados.resumo.variacaoCliques) : "—",
            },
            {
              titulo: "Conversão em clique",
              valor: `${dados?.resumo.conversao ?? 0}%`,
              detalhe: "sessões que avançaram",
            },
            {
              titulo: "Cliques em reviews",
              valor: dados?.resumo.cliquesReview ?? 0,
              detalhe: "recomendação do casal",
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

        <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                Como usar amanhã
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Um link diferente em cada Instagram
              </h2>
              <p className="mt-2 max-w-3xl leading-7 text-emerald-950/75">
                Gabriel usa o link do Gabriel, Bruna usa o link da Bruna e o
                perfil Achados do Casal usa o link do Achados. A atribuição fica
                preservada por {dados?.campanha.atribuicaoDias ?? 30} dias e os
                cliques posteriores continuam ligados ao perfil que trouxe a pessoa.
              </p>
            </div>
            <Link
              href="/black-friday"
              target="_blank"
              className="inline-flex justify-center rounded-xl bg-emerald-700 px-5 py-3 font-black text-white transition hover:bg-emerald-800"
            >
              Ver Central Black Friday ↗
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {(dados?.perfis ?? []).map((perfil) => (
            <article
              key={perfil.codigo}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div
                className={`bg-gradient-to-br p-6 text-white ${
                  CORES[perfil.codigo] || "from-slate-700 to-slate-950"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">
                  Link exclusivo
                </p>
                <h2 className="mt-2 text-2xl font-black">{perfil.nome}</h2>
                <p className="mt-3 break-all rounded-xl bg-black/20 px-3 py-2 text-sm font-bold">
                  {perfil.link}
                </p>
                <button
                  type="button"
                  onClick={() => void copiar(perfil)}
                  className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  {copiado === perfil.codigo ? "✓ Link copiado" : "Copiar link"}
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Visitas", perfil.visitas],
                    ["Sessões", perfil.sessoes],
                    ["Cliques", perfil.cliques],
                    ["Conversão", `${perfil.conversao}%`],
                    ["Produtos", perfil.cliquesProdutos],
                    ["Cupons/ofertas", perfil.cliquesOfertas],
                  ].map(([rotulo, valor]) => (
                    <div key={String(rotulo)} className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        {rotulo}
                      </p>
                      <p className="mt-1 text-2xl font-black">{valor}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black">Mais procurados</h3>
                    <span className="text-xs font-bold text-slate-400">
                      {dias} dias
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {perfil.topItens.map((item, indice) => (
                      <div key={item.chave} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-black text-white">
                          {indice + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-black">
                            {item.titulo}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.loja}
                            {moeda(item.preco) ? ` · ${moeda(item.preco)}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-black">{item.quantidade}</span>
                      </div>
                    ))}
                    {!carregando && perfil.topItens.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                        Os primeiros acessos ainda não geraram cliques atribuídos.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-blue-600">
              Leitura da campanha
            </p>
            <h2 className="mt-1 text-2xl font-black">O que comparar após divulgar</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Qual perfil trouxe mais sessões humanas",
                "Qual audiência clicou mais em cupons e produtos",
                "Qual perfil levou mais gente até as reviews",
                "Quais produtos despertaram interesse em cada público",
                "Conversão de visita para clique por perfil",
                "Diferença entre alcance e intenção real de compra",
              ].map((texto) => (
                <div key={texto} className="rounded-2xl bg-blue-50 p-4 font-bold text-blue-950">
                  ✓ {texto}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">
              Qualidade dos dados
            </p>
            <h2 className="mt-1 text-2xl font-black">Entradas registradas</h2>
            <div className="mt-5 space-y-3">
              {[
                ["Humanas", dados?.diagnostico.humanos ?? 0, "text-emerald-700"],
                ["Bots / prévias", dados?.diagnostico.bots ?? 0, "text-amber-700"],
                ["Internas", dados?.diagnostico.internos ?? 0, "text-blue-700"],
                ["Não classificadas", dados?.diagnostico.naoClassificados ?? 0, "text-slate-600"],
              ].map(([rotulo, valor, classe]) => (
                <div
                  key={String(rotulo)}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <span className="font-bold text-slate-600">{rotulo}</span>
                  <span className={`text-2xl font-black ${classe}`}>{valor}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Pré-visualizações automáticas do Instagram e outros robôs ficam fora
              dos números principais, evitando uma campanha artificialmente inflada.
            </p>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/economize/performance"
            className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white transition hover:bg-violet-700"
          >
            📊 Consultoria & Conteúdo
          </Link>
          <Link
            href="/admin/economize"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
          >
            Voltar à Central Economize
          </Link>
        </div>
      </div>
    </main>
  );
}
