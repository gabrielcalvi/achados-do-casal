"use client";

import { useState } from "react";

type Props = {
  produtoId: number;
  precoAtual: number;
};

export default function AlertaPrecoInteresse({ produtoId, precoAtual }: Props) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [precoAlvo, setPrecoAlvo] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "erro">("idle");

  async function cadastrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado("enviando");
    const alvo = precoAlvo.trim() ? Number(precoAlvo.replace(",", ".")) : null;

    const resposta = await fetch("/api/comunidade/alerta-preco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtoId, email: email.trim(), precoAlvo: alvo }),
    });

    if (!resposta.ok) {
      setEstado("erro");
      return;
    }
    setEstado("ok");
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="font-black text-emerald-900">🔔 Avise-me quando baixar</p>
          <p className="mt-1 text-xs font-semibold text-emerald-800">
            Beta: monitoramos o preço e registramos quando atingir sua meta.
          </p>
        </div>
        <span className="text-xl text-emerald-800">{aberto ? "−" : "+"}</span>
      </button>

      {aberto ? (
        <form onSubmit={cadastrar} className="mt-4 grid gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail"
            className="h-11 rounded-xl border border-emerald-200 bg-white px-3 outline-none focus:border-emerald-600"
          />
          <label className="grid gap-1 text-xs font-bold text-emerald-900">
            Quero ser avisado quando chegar em (opcional)
            <input
              inputMode="decimal"
              value={precoAlvo}
              onChange={(e) => setPrecoAlvo(e.target.value)}
              placeholder={precoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              className="h-11 rounded-xl border border-emerald-200 bg-white px-3 outline-none focus:border-emerald-600"
            />
          </label>
          <p className="text-[11px] leading-5 text-emerald-800">
            Nesta fase beta, o monitoramento já funciona. O disparo automático por e-mail será ativado quando o canal de envio estiver configurado; alertas atingidos ficam disponíveis para aviso manual no nosso painel.
          </p>
          <button
            type="submit"
            disabled={estado === "enviando"}
            className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {estado === "enviando" ? "Cadastrando..." : "Cadastrar alerta"}
          </button>
          {estado === "ok" ? (
            <p className="text-xs font-black text-emerald-800">
              ✅ Alerta cadastrado. Vamos acompanhar este preço.
            </p>
          ) : null}
          {estado === "erro" ? (
            <p className="text-xs font-black text-red-700">
              Não foi possível cadastrar o alerta agora.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
