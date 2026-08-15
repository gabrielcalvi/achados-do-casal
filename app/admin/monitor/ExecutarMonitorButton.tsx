"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

type RespostaMonitor = {
  sucesso?: boolean;
  total?: number;
  alterados?: number;
  erros?: number;
  error?: string;
  erro?: string;
  detalhes?: string;
};

function formatarTempo(
  totalSegundos: number
) {
  const minutos = Math.floor(
    totalSegundos / 60
  )
    .toString()
    .padStart(2, "0");

  const segundos = (
    totalSegundos % 60
  )
    .toString()
    .padStart(2, "0");

  return `${minutos}:${segundos}`;
}

function etapaDoMonitor(progresso: number) {
  if (progresso < 18) {
    return "Preparando produtos monitorados";
  }

  if (progresso < 78) {
    return "Consultando preços nas lojas";
  }

  if (progresso < 95) {
    return "Comparando preços e aplicando alterações";
  }

  return "Finalizando verificação";
}

function urlExecucaoMonitor() {
  if (typeof window === "undefined") {
    return "/api/monitor/run";
  }

  const host = window.location.hostname.toLowerCase();
  const ambienteLocal =
    host === "localhost" ||
    host === "127.0.0.1";

  return ambienteLocal
    ? "/api/monitor/run?modo=local"
    : "/api/monitor/run";
}

export default function ExecutarMonitorButton() {
  const router = useRouter();

  const [
    executando,
    setExecutando,
  ] = useState(false);

  const [
    segundosExecucao,
    setSegundosExecucao,
  ] = useState(0);

  const [
    progresso,
    setProgresso,
  ] = useState(0);

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  const [
    erro,
    setErro,
  ] = useState("");

  useEffect(() => {
    if (!executando) {
      return;
    }

    const intervalo =
      window.setInterval(() => {
        setSegundosExecucao(
          (segundosAtuais) =>
            segundosAtuais + 1
        );

        setProgresso((valorAtual) => {
          if (valorAtual >= 94) {
            return valorAtual;
          }

          if (valorAtual < 25) {
            return Math.min(25, valorAtual + 3);
          }

          if (valorAtual < 65) {
            return Math.min(65, valorAtual + 2);
          }

          return Math.min(94, valorAtual + 1);
        });
      }, 1000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [executando]);

  async function executarMonitor() {
    try {
      setExecutando(true);
      setSegundosExecucao(0);
      setProgresso(5);
      setMensagem("");
      setErro("");

      const resposta = await fetch(
        urlExecucaoMonitor(),
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const resultado =
        (await resposta.json()) as RespostaMonitor;

      if (!resposta.ok || resultado.sucesso === false) {
        throw new Error(
          resultado.error ||
            resultado.erro ||
            resultado.detalhes ||
            "Não foi possível executar o monitor."
        );
      }

      const total =
        resultado.total ?? 0;

      const alterados =
        resultado.alterados ?? 0;

      const erros =
        resultado.erros ?? 0;

      setProgresso(100);
      setMensagem(
        `${total} produto(s) verificado(s): ${alterados} preço(s) atualizado(s) automaticamente e ${erros} erro(s).`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Erro ao executar monitor:",
        error
      );

      setProgresso(100);
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar os preços."
      );
    } finally {
      setExecutando(false);
    }
  }

  const mostrarStatus =
    executando || Boolean(mensagem) || Boolean(erro);

  const etapa = erro
    ? "Verificação interrompida"
    : mensagem
      ? "Verificação concluída"
      : etapaDoMonitor(progresso);

  return (
    <div className="flex w-full max-w-xl flex-col items-end gap-3">
      <button
        type="button"
        onClick={executarMonitor}
        disabled={executando}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {executando
          ? `🔄 Verificando preços... ${formatarTempo(
              segundosExecucao
            )}`
          : "🔄 Atualizar preços agora"}
      </button>

      {mostrarStatus && (
        <div
          className={`w-full rounded-2xl border p-4 ${
            erro
              ? "border-red-200 bg-red-50"
              : mensagem
                ? "border-emerald-200 bg-emerald-50"
                : "border-emerald-200 bg-emerald-50/60"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Status da atualização
              </p>
              <p
                className={`mt-1 font-black ${
                  erro
                    ? "text-red-700"
                    : "text-emerald-800"
                }`}
              >
                {erro ? "❌" : mensagem ? "✅" : "⚙️"} {etapa}
              </p>
            </div>

            <div className="text-right">
              <p className="font-black text-slate-800">
                {progresso}%
              </p>
              {executando && (
                <p className="text-xs font-bold text-slate-500">
                  {formatarTempo(segundosExecucao)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                erro
                  ? "bg-red-500"
                  : "bg-emerald-600"
              }`}
              style={{
                width: `${progresso}%`,
              }}
            />
          </div>

          {mensagem && (
            <p className="mt-3 text-sm font-bold text-emerald-700">
              {mensagem}
            </p>
          )}

          {erro && (
            <p className="mt-3 text-sm font-bold text-red-600">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}