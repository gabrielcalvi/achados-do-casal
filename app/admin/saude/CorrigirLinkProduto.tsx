"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  produtoId: number;
  linkAtual?: string | null;
};

export default function CorrigirLinkProduto({ produtoId, linkAtual }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [link, setLink] = useState(linkAtual || "");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function salvar() {
    const valor = link.trim();

    if (!valor) {
      setMensagem("Cole o link original do produto.");
      return;
    }

    try {
      new URL(valor);
    } catch {
      setMensagem("Informe uma URL válida.");
      return;
    }

    setSalvando(true);
    setMensagem("Salvando e validando...");

    const { error } = await supabase
      .from("produtos")
      .update({
        link: valor,
        monitor_erro: null,
        monitor_erro_em: null,
        monitor_falhas_consecutivas: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", produtoId);

    if (error) {
      setMensagem(error.message);
      setSalvando(false);
      return;
    }

    try {
      const resposta = await fetch(`/api/monitor/run?id=${produtoId}`, {
        cache: "no-store",
      });
      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok || !dados?.sucesso) {
        throw new Error(dados?.erro || "Link salvo, mas a validação falhou.");
      }

      setMensagem("Link salvo e monitor validado.");
    } catch (erroValidacao) {
      setMensagem(
        erroValidacao instanceof Error
          ? erroValidacao.message
          : "Link salvo, mas não foi possível validar agora."
      );
    } finally {
      setSalvando(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Cole aqui o link original do produto"
        className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
      >
        {salvando ? "Validando..." : "Salvar e validar"}
      </button>
      {mensagem ? (
        <span className="text-xs font-bold text-slate-600 sm:max-w-64">{mensagem}</span>
      ) : null}
    </div>
  );
}
