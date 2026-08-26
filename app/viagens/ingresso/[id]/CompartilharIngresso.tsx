"use client";

import { useState } from "react";

type Props = {
  titulo: string;
  texto: string;
};

export default function CompartilharIngresso({ titulo, texto }: Props) {
  const [status, setStatus] = useState("");

  function urlAtual() {
    return window.location.href;
  }

  function compartilharWhatsApp() {
    const mensagem = `${texto}\n\n${urlAtual()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  }

  async function compartilhar() {
    const url = urlAtual();

    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: texto, url });
        setStatus("Compartilhamento aberto.");
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatus("Link copiado!");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Não foi possível compartilhar agora.");
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlAtual());
      setStatus("Link copiado!");
    } catch {
      setStatus("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={compartilharWhatsApp}
          className="rounded-xl bg-green-600 px-5 py-3 font-black text-white transition hover:bg-green-700"
        >
          💬 Compartilhar no WhatsApp
        </button>
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
      </div>
      {status ? <p className="mt-2 text-sm font-bold text-emerald-700">{status}</p> : null}
    </div>
  );
}
