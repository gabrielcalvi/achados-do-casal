"use client";

import { useState } from "react";

type RespostaSessao = {
  sucesso?: boolean;
  mensagem?: string;
  erro?: string;
  atualizado_em?: string;
};

export default function RenovarSessaoMlV2() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function enviarSessao() {
    if (!arquivo) {
      setErro("Selecione o arquivo meli-buyer-auth.json gerado no computador.");
      return;
    }

    try {
      setEnviando(true);
      setErro("");
      setMensagem("");

      const formData = new FormData();
      formData.append("arquivo", arquivo);

      const resposta = await fetch(
        "/api/admin/economize/cupons/ml-v2/sessao",
        {
          method: "POST",
          body: formData,
        }
      );

      const dados = (await resposta.json()) as RespostaSessao;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(
          dados.erro || "Nao foi possivel atualizar a sessao ML V2."
        );
      }

      setMensagem(
        "Sessao enviada ao Sandbox. Agora execute a coleta ML V2 novamente."
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar a sessao."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-wider text-amber-700">
            Renovar sessao do Mercado Livre
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Use somente quando a coleta informar sessao expirada
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            No computador do projeto, rode <strong>npm run ml-v2:login</strong>.
            Uma janela visivel do Chrome sera aberta. Faca login no Mercado Livre,
            confirme que a pagina de cupons abriu e pressione ENTER no terminal.
            O arquivo <strong>tmp/meli-buyer-auth.json</strong> sera criado localmente.
          </p>
          <p className="mt-2 text-xs font-bold text-amber-800">
            Esse arquivo contem uma sessao autenticada. Nao envie por mensagem, nao
            coloque no GitHub e nao compartilhe com terceiros.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center">
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            setArquivo(event.target.files?.[0] ?? null);
            setErro("");
            setMensagem("");
          }}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
        />

        <button
          type="button"
          onClick={enviarSessao}
          disabled={enviando || !arquivo}
          className="rounded-xl bg-amber-600 px-5 py-3 font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Enviando sessao..." : "Enviar sessao ao Sandbox"}
        </button>
      </div>

      {mensagem && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
          ✅ {mensagem}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          ❌ {erro}
        </div>
      )}
    </section>
  );
}
