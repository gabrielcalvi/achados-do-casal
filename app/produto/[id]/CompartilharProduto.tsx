"use client";

import { useState } from "react";

type Props = {
  url: string;
  titulo: string;
  descricao?: string | null;
};

export default function CompartilharProduto({ url, titulo, descricao }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const texto = [titulo, descricao].filter(Boolean).join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: titulo,
          text: texto || titulo,
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copie o link do produto:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-blue-950 bg-white px-6 py-4 font-black text-blue-950 transition hover:bg-blue-50"
    >
      {copiado ? "✅ Link copiado" : "📲 Compartilhar"}
    </button>
  );
}
