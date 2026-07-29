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
      }, 1000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [executando]);

  async function executarMonitor() {
    try {
      setExecutando(true);
      setSegundosExecucao(0);
      setMensagem("");
      setErro("");

      const resposta = await fetch(
        "/api/monitor/run",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const resultado =
        (await resposta.json()) as RespostaMonitor;

      if (!resposta.ok) {
        throw new Error(
          resultado.error ||
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

      setMensagem(
        `${total} produto(s) verificado(s): ${alterados} alteração(ões) e ${erros} erro(s).`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Erro ao executar monitor:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar os preços."
      );
    } finally {
      setExecutando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
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

      {executando && (
        <p className="max-w-md text-right text-sm font-bold text-slate-600">
          O monitor continua em execução.
          Não feche esta página.
        </p>
      )}

      {mensagem && (
        <p className="max-w-md text-right text-sm font-bold text-emerald-700">
          {mensagem}
        </p>
      )}

      {erro && (
        <p className="max-w-md text-right text-sm font-bold text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}