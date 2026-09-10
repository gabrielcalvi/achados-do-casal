"use client";

import { useEffect, useState } from "react";

export default function AdminLomadeePage() {
  const [apiKey, setApiKey] = useState("");
  const [configurada, setConfigurada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/admin/lomadee", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConfigurada(Boolean(d.configurada)))
      .catch(() => setErro("Não foi possível consultar o status da Lomadee."))
      .finally(() => setCarregando(false));
  }, []);

  async function conectar() {
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/lomadee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao conectar a Lomadee.");
      setConfigurada(true);
      setApiKey("");
      setMensagem(`Lomadee conectada com sucesso${dados.totalMarcas ? ` · ${dados.totalMarcas} marca(s) acessível(is)` : ""}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conectar a Lomadee.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-wider text-orange-500">Achados do Casal</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-black">Integração Lomadee</h1>
              <p className="mt-2 text-slate-600">Conecte a Affiliate API para importar produtos, preços, imagens, campanhas e gerar deeplinks monetizados.</p>
            </div>
            <span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${configurada ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              {carregando ? "Verificando..." : configurada ? "Conectada" : "Não conectada"}
            </span>
          </div>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-black">API Key</h2>
            <p className="mt-1 text-sm text-slate-500">Cole a chave gerada na Lomadee. Ela é testada antes de ser salva e fica armazenada de forma criptografada no Vault do Supabase.</p>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={configurada ? "Cole uma nova chave apenas se quiser substituir a atual" : "Cole aqui a API Key da Lomadee"}
              className="mt-4 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm outline-none focus:border-slate-500"
            />
            <button
              onClick={conectar}
              disabled={salvando || !apiKey.trim()}
              className="mt-3 rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando ? "Testando e salvando..." : configurada ? "Substituir e testar chave" : "Conectar e testar Lomadee"}
            </button>
          </div>

          {mensagem ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{mensagem}</div> : null}
          {erro ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{erro}</div> : null}
        </section>
      </div>
    </main>
  );
}
