"use client";

import { useState } from "react";

type Props = {
  titulo: string;
  descricao: string;
  url: string;
};

function copiarLinkFallback(url: string) {
  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function ProdutoCompartilhar({ titulo, descricao, url }: Props) {
  const [feedback, setFeedback] = useState("");

  async function compartilhar() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: titulo,
          text: descricao,
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        copiarLinkFallback(url);
      }

      setFeedback("Link copiado!");
      window.setTimeout(() => setFeedback(""), 2200);
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          copiarLinkFallback(url);
        }
        setFeedback("Link copiado!");
        window.setTimeout(() => setFeedback(""), 2200);
      } catch {
        setFeedback("Não foi possível compartilhar agora.");
        window.setTimeout(() => setFeedback(""), 3000);
      }
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={compartilhar}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-950 bg-white px-6 py-4 font-black text-blue-950 transition hover:bg-blue-50"
        aria-label={`Compartilhar ${titulo}`}
      >
        📲 Compartilhar
      </button>

      {feedback ? (
        <p className="mt-2 text-center text-sm font-bold text-emerald-700" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
