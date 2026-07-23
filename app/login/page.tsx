"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <p className="text-sm font-black uppercase tracking-wider text-pink-500">
          Achados do Casal
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Acesso Administrativo
        </h1>

        <p className="mt-2 text-slate-500">
          Entre com seu e-mail e senha.
        </p>

        <div className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border p-4"
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl border p-4"
          />

          <button
            onClick={entrar}
            disabled={carregando}
            className="w-full rounded-xl bg-blue-950 p-4 font-black text-white"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}