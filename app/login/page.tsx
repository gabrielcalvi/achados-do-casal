"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(event?: React.FormEvent) {
    event?.preventDefault();
    setCarregando(true);
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("Não foi possível entrar. Confira e-mail e senha.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <Link href="/" className="inline-flex">
          <img
            src="/logo-achados-do-casal.png"
            alt="Achados do Casal"
            className="h-14 w-auto object-contain"
          />
        </Link>

        <p className="mt-6 text-sm font-black uppercase tracking-wider text-pink-500">
          Área restrita
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          Acesso administrativo
        </h1>
        <p className="mt-2 text-slate-500">
          Entre para gerenciar produtos, cupons, monitor e Radar.
        </p>

        <form onSubmit={entrar} className="mt-7 space-y-4">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-4 outline-none transition focus:border-blue-900 focus:bg-white"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-4 outline-none transition focus:border-blue-900 focus:bg-white"
            />
          </label>

          {erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-blue-950 p-4 font-black text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-5 inline-flex text-sm font-bold text-slate-500 hover:text-slate-900"
        >
          ← Voltar ao site
        </Link>
      </div>
    </main>
  );
}
