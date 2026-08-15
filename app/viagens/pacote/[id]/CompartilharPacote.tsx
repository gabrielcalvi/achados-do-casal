"use client";

import { useState } from "react";

type Props = {
  titulo: string;
  texto: string;
};

export default function CompartilharPacote({ titulo, texto }: Props) {
  const [status, setStatus] = useState("");

  async function compartilhar() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: texto, url });
        setStatus("Compartilhamento aberto.");
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatus("Link copiado!");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatus("Não foi possível compartilhar agora.");
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copiado!");
    } catch {
      setStatus("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={compartilhar}
        className="rounded-xl bg-sky-700 px-5 py-3 font-black text-white transition hover:bg-sky-800"
      >
        📤 Compartilhar
      </button>
      <button
        type="button"
        onClick={copiar}
        className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 transition hover:bg-slate-50"
      >
        🔗 Copiar link
      </button>
      {status && <span className="text-sm font-bold text-emerald-700">{status}</span>}
    </div>
  );
}
