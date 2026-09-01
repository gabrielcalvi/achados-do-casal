"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExecutarWatchdog() {
  const router = useRouter();
  const [executando, setExecutando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function executar() {
    setExecutando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/admin/watchdog", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok || !dados?.sucesso) {
        throw new Error(dados?.erro || `Falha HTTP ${resposta.status}`);
      }

      const problemas = Number(dados.erros || 0) + Number(dados.atencoes || 0);
      setMensagem(
        problemas === 0
          ? "Diagnóstico concluído: tudo saudável."
          : `Diagnóstico concluído: ${problemas} ponto(s) pedindo atenção.`
      );
      router.refresh();
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Falha ao executar o Watchdog.");
    } finally {
      setExecutando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={executar}
        disabled={executando}
        className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {executando ? "Verificando..." : "Rodar diagnóstico agora"}
      </button>
      {mensagem ? <p className="max-w-sm text-xs font-bold text-slate-500">{mensagem}</p> : null}
    </div>
  );
}
