"use client";

import { useEffect, useState } from "react";

type ResultadoMlV2 = {
  sucesso?: boolean;
  erro?: string;
  total_paginas_lidas?: number;
  total_encontrados?: number;
  valores_encontrados?: number[];
  por_valor?: Record<string, number>;
  publicacao_automatica?: boolean;
  afiliado_obrigatorio_antes_publicacao?: boolean;
  executado_em?: string;
  amostra?: Array<{
    campanha_id?: string | null;
    titulo?: string | null;
    valor_desconto?: number | null;
    compra_minima?: number | null;
    validade?: string | null;
  }>;
};

function moeda(valor: number | null | undefined) {
  if (valor === null || valor === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function etapaExecucao(progresso: number) {
  if (progresso < 18) {
    return "Preparando execução";
  }

  if (progresso < 38) {
    return "Conectando ao Vercel Sandbox";
  }

  if (progresso < 76) {
    return "Coletando cupons oficiais do Mercado Livre";
  }

  if (progresso < 96) {
    return "Filtrando cupons amplos e validando regras";
  }

  return "Finalizando resultado";
}

export default function PainelMlV2() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] =
    useState<ResultadoMlV2 | null>(null);
  const [erro, setErro] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!executando) {
      return;
    }

    const iniciadoEm = Date.now();

    const timer = window.setInterval(() => {
      setSegundos(
        Math.floor((Date.now() - iniciadoEm) / 1000)
      );

      setProgresso((valorAtual) => {
        if (valorAtual >= 94) {
          return valorAtual;
        }

        if (valorAtual < 22) {
          return Math.min(22, valorAtual + 3);
        }

        if (valorAtual < 55) {
          return Math.min(55, valorAtual + 2);
        }

        return Math.min(94, valorAtual + 1);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [executando]);

  async function executar() {
    try {
      setExecutando(true);
      setErro("");
      setResultado(null);
      setProgresso(6);
      setSegundos(0);

      const resposta = await fetch(
        "/api/admin/economize/cupons/ml-v2/executar",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const dados =
        (await resposta.json()) as ResultadoMlV2;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.erro ||
            "A coleta ML V2 não foi concluída."
        );
      }

      setResultado(dados);
      setProgresso(100);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado no ML V2."
      );
      setProgresso(100);
    } finally {
      setExecutando(false);
    }
  }

  const etapa = erro
    ? "Execução interrompida"
    : resultado
      ? "Coleta concluída"
      : etapaExecucao(progresso);

  return (
    <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-blue-600">
            Mercado Livre V2
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Cupons oficiais e amplos
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Busca apenas cupons criados pelo próprio Mercado Livre,
            com desconto fixo e sem restrição de item, vendedor,
            categoria, marca ou produto. Esta etapa é somente de
            coleta e diagnóstico.
          </p>
        </div>

        <button
          type="button"
          onClick={executar}
          disabled={executando}
          className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {executando
            ? "Executando ML V2..."
            : "Executar coleta ML V2"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">
            Publicação automática
          </p>
          <p className="mt-2 font-black text-slate-950">
            🔒 Bloqueada
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Link de afiliado
          </p>
          <p className="mt-2 font-black text-slate-950">
            ✅ Obrigatório antes de publicar
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-600">
            Escopo
          </p>
          <p className="mt-2 font-black text-slate-950">
            Site inteiro / sem restrições específicas
          </p>
        </div>
      </div>

      {(executando || resultado || erro) && (
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            erro
              ? "border-red-200 bg-red-50"
              : resultado
                ? "border-emerald-200 bg-emerald-50"
                : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Status da execução
              </p>
              <p
                className={`mt-1 font-black ${
                  erro
                    ? "text-red-700"
                    : resultado
                      ? "text-emerald-700"
                      : "text-blue-800"
                }`}
              >
                {erro ? "❌" : resultado ? "✅" : "⚙️"} {etapa}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-black text-slate-700">
                {progresso}%
              </p>
              {executando && (
                <p className="text-xs font-bold text-slate-500">
                  {segundos}s em execução
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                erro
                  ? "bg-red-500"
                  : resultado
                    ? "bg-emerald-500"
                    : "bg-blue-600"
              }`}
              style={{ width: `${progresso}%` }}
            />
          </div>

          {executando && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              A barra acompanha visualmente a execução e só chega a 100% quando a API confirma o término.
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="mt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Páginas lidas</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {resultado.total_paginas_lidas ?? 0}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Cupons válidos encontrados</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {resultado.total_encontrados ?? 0}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">Valores encontrados</p>
              <p className="mt-2 font-black text-slate-950">
                {(resultado.valores_encontrados ?? [])
                  .map((valor) => moeda(valor))
                  .join(", ") || "Nenhum"}
              </p>
            </div>
          </div>

          {(resultado.amostra?.length ?? 0) > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-black">Cupom</th>
                    <th className="px-4 py-3 font-black">Desconto</th>
                    <th className="px-4 py-3 font-black">Compra mínima</th>
                    <th className="px-4 py-3 font-black">Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.amostra?.map((cupom, indice) => (
                    <tr
                      key={`${cupom.campanha_id ?? "sem-id"}-${indice}`}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {cupom.titulo || cupom.campanha_id || "Cupom oficial"}
                      </td>
                      <td className="px-4 py-3">
                        {moeda(cupom.valor_desconto)}
                      </td>
                      <td className="px-4 py-3">
                        {moeda(cupom.compra_minima)}
                      </td>
                      <td className="px-4 py-3">
                        {cupom.validade
                          ? new Date(cupom.validade).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
