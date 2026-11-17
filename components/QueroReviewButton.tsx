"use client";

import { useState } from "react";

function obterSessionId() {
  const chave = "achados_session_id";
  let id = window.localStorage.getItem(chave);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    window.localStorage.setItem(chave, id);
  }
  return id;
}

export default function QueroReviewButton({ produtoId }: { produtoId: number }) {
  const [estado,setEstado]=useState<"idle"|"enviando"|"ok"|"erro">("idle");

  async function pedir(){
    setEstado("enviando");
    const r=await fetch("/api/comunidade/review-pedido",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({produtoId,sessionId:obterSessionId()})
    });
    setEstado(r.ok?"ok":"erro");
  }

  return (
    <button
      type="button"
      onClick={pedir}
      disabled={estado==="enviando"||estado==="ok"}
      className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-70"
    >
      {estado==="ok" ? "✅ Pedido registrado" : estado==="enviando" ? "Registrando..." : "🙋 Quero que vocês testem este produto"}
    </button>
  );
}
