"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FAVORITOS_KEY = "achados_favoritos";
const COMPARAR_KEY = "achados_comparar";

function lerIds(chave: string) {
  if (typeof window === "undefined") return [] as number[];
  try {
    const valor = JSON.parse(window.localStorage.getItem(chave) || "[]");
    return Array.isArray(valor)
      ? valor.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

function salvarIds(chave: string, ids: number[]) {
  window.localStorage.setItem(chave, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("achados:lista-local"));
}

type Props = {
  produtoId: number;
  compacto?: boolean;
};

export default function ProdutoAcoesLocais({ produtoId, compacto = false }: Props) {
  const [favorito, setFavorito] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [limite, setLimite] = useState(false);

  useEffect(() => {
    const atualizar = () => {
      setFavorito(lerIds(FAVORITOS_KEY).includes(produtoId));
      setComparando(lerIds(COMPARAR_KEY).includes(produtoId));
    };
    atualizar();
    window.addEventListener("achados:lista-local", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("achados:lista-local", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, [produtoId]);

  function alternarFavorito() {
    const ids = lerIds(FAVORITOS_KEY);
    const novos = ids.includes(produtoId)
      ? ids.filter((id) => id !== produtoId)
      : [produtoId, ...ids].slice(0, 100);
    salvarIds(FAVORITOS_KEY, novos);
    setFavorito(novos.includes(produtoId));
  }

  function alternarComparacao() {
    const ids = lerIds(COMPARAR_KEY);
    if (ids.includes(produtoId)) {
      const novos = ids.filter((id) => id !== produtoId);
      salvarIds(COMPARAR_KEY, novos);
      setComparando(false);
      setLimite(false);
      return;
    }
    if (ids.length >= 3) {
      setLimite(true);
      setTimeout(() => setLimite(false), 2500);
      return;
    }
    const novos = [...ids, produtoId];
    salvarIds(COMPARAR_KEY, novos);
    setComparando(true);
    setLimite(false);
  }

  if (compacto) {
    return (
      <div className="absolute bottom-3 right-3 z-20 flex gap-2">
        <button
          type="button"
          aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorito}
          onClick={alternarFavorito}
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/95 text-lg shadow-sm transition hover:scale-105"
          title={favorito ? "Remover dos favoritos" : "Favoritar"}
        >
          {favorito ? "❤️" : "🤍"}
        </button>
        <button
          type="button"
          aria-label={comparando ? "Remover da comparação" : "Adicionar à comparação"}
          aria-pressed={comparando}
          onClick={alternarComparacao}
          className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/95 text-lg shadow-sm transition hover:scale-105"
          title={comparando ? "Remover da comparação" : "Comparar"}
        >
          ⚖️
        </button>
        {limite ? (
          <span className="absolute bottom-12 right-0 w-44 rounded-lg bg-slate-950 px-3 py-2 text-center text-[11px] font-bold text-white shadow-lg">
            Compare até 3 produtos por vez.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={alternarFavorito}
          className={`inline-flex h-12 items-center justify-center rounded-xl border px-4 text-sm font-black transition ${
            favorito
              ? "border-pink-200 bg-pink-50 text-pink-700"
              : "border-slate-200 bg-white text-slate-700 hover:border-pink-300"
          }`}
        >
          {favorito ? "❤️ Salvo nos favoritos" : "🤍 Salvar nos favoritos"}
        </button>
        <button
          type="button"
          onClick={alternarComparacao}
          className={`inline-flex h-12 items-center justify-center rounded-xl border px-4 text-sm font-black transition ${
            comparando
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
          }`}
        >
          ⚖️ {comparando ? "Na comparação" : "Comparar produto"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold">
        <Link href="/favoritos" className="text-pink-700 hover:underline">
          Ver meus favoritos →
        </Link>
        <Link href="/comparar" className="text-blue-900 hover:underline">
          Abrir comparação →
        </Link>
      </div>
      {limite ? (
        <p className="mt-2 text-xs font-bold text-amber-700">
          Você já selecionou 3 produtos. Remova um na página de comparação para adicionar outro.
        </p>
      ) : null}
    </div>
  );
}
