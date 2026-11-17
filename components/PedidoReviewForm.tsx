"use client";

import { useState } from "react";

function obterSessionId() {
  const chave = "achados_session_id";
  let id = window.localStorage.getItem(chave);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(chave, id);
  }
  return id;
}

export default function PedidoReviewForm() {
  const [urlProduto, setUrlProduto] = useState("");
  const [nomeProduto, setNomeProduto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "erro">("idle");

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!urlProduto.trim() && !nomeProduto.trim()) return;
    setEstado("enviando");

    const resposta = await fetch("/api/comunidade/review-pedido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urlProduto: urlProduto.trim(),
        nomeProduto: nomeProduto.trim(),
        mensagem: mensagem.trim(),
        empresa,
        sessionId: obterSessionId(),
      }),
    });

    if (!resposta.ok) {
      setEstado("erro");
      return;
    }

    setUrlProduto("");
    setNomeProduto("");
    setMensagem("");
    setEstado("ok");
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-900">
        🙋 Você escolhe os próximos testes
      </span>
      <h2 className="mt-3 text-2xl font-black sm:text-3xl">
        Tem algum produto que você quer que a gente teste?
      </h2>
      <p className="mt-2 max-w-3xl text-slate-600">
        Manda o nome ou cola o link. Os produtos mais pedidos entram no nosso radar de próximos reviews.
      </p>

      <form onSubmit={enviar} className="mt-6 grid gap-3">
        <input
          type="text"
          value={nomeProduto}
          onChange={(e) => setNomeProduto(e.target.value)}
          maxLength={200}
          placeholder="Nome do produto (ex.: cafeteira, fone, maquiagem...)"
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none focus:border-blue-900 focus:bg-white"
        />
        <input
          type="url"
          value={urlProduto}
          onChange={(e) => setUrlProduto(e.target.value)}
          maxLength={1200}
          placeholder="Link do produto (opcional)"
          className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none focus:border-blue-900 focus:bg-white"
        />
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="O que você quer que a gente confira nesse produto? (opcional)"
          className="rounded-xl border border-slate-300 bg-slate-50 p-4 outline-none focus:border-blue-900 focus:bg-white"
        />
        <input
          type="text"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={estado === "enviando" || (!urlProduto.trim() && !nomeProduto.trim())}
          className="inline-flex h-12 w-fit items-center justify-center rounded-xl bg-blue-950 px-6 font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estado === "enviando" ? "Enviando..." : "Quero que vocês testem →"}
        </button>
        {estado === "ok" ? (
          <p className="text-sm font-bold text-emerald-700">
            ✅ Pedido registrado! Agora ele entra na nossa lista de produtos pedidos pela comunidade.
          </p>
        ) : null}
        {estado === "erro" ? (
          <p className="text-sm font-bold text-red-700">
            Não foi possível registrar agora. Tente novamente em instantes.
          </p>
        ) : null}
      </form>
    </section>
  );
}
