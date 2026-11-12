"use client";

import { useMemo, useState } from "react";

type Props = {
  whatsappNumero?: string;
  fallbackUrl: string;
};

function dataBr(valor: string) {
  if (!valor) return "flexível";
  const [ano, mes, dia] = valor.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

export default function SolicitarVooWhatsApp({
  whatsappNumero = "",
  fallbackUrl,
}: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [ida, setIda] = useState("");
  const [volta, setVolta] = useState("");
  const [adultos, setAdultos] = useState("2");
  const [criancas, setCriancas] = useState("0");
  const [bagagem, setBagagem] = useState("A decidir");
  const [flexibilidade, setFlexibilidade] = useState("Datas exatas");
  const [orcamento, setOrcamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const numero = useMemo(
    () => whatsappNumero.replace(/\D/g, ""),
    [whatsappNumero]
  );

  const podeEnviar = origem.trim().length >= 2 && destino.trim().length >= 2;

  function mensagem() {
    return [
      "Olá! Vim pelo Achados do Casal e quero uma cotação de voo.",
      "",
      `✈️ Origem: ${origem.trim() || "não informada"}`,
      `📍 Destino: ${destino.trim() || "não informado"}`,
      `🗓️ Ida: ${dataBr(ida)}`,
      `🗓️ Volta: ${dataBr(volta)}`,
      `👤 Adultos: ${adultos}`,
      `👧 Crianças: ${criancas}`,
      `🧳 Bagagem: ${bagagem}`,
      `🔄 Flexibilidade: ${flexibilidade}`,
      orcamento.trim() ? `💰 Orçamento aproximado: R$ ${orcamento.trim()}` : "",
      observacoes.trim() ? `📝 Observações: ${observacoes.trim()}` : "",
      "",
      "Pode pesquisar as melhores opções para mim?",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function enviar() {
    if (!podeEnviar) return;

    const texto = mensagem();

    void fetch("/api/viagens/interacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: "pedido_cotacao_whatsapp",
        origem: origem.trim(),
        destino: destino.trim(),
        detalhe: `${dataBr(ida)} → ${dataBr(volta)} | ${adultos} adulto(s) | ${criancas} criança(s)`,
      }),
      keepalive: true,
    }).catch(() => undefined);

    if (numero) {
      window.open(
        `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    navigator.clipboard?.writeText(texto).catch(() => undefined);
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="cotacao-voo" className="border-y border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              Pesquisa de voo sob medida
            </span>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
              Você pede a rota.
              <span className="block text-cyan-300">A gente pesquisa só quando precisa.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Em vez de fazer milhares de buscas automáticas, a pesquisa agora é feita quando existe uma viagem real. Você envia os dados pelo WhatsApp e o Achados do Casal procura as melhores opções para o seu caso.
            </p>
            <div className="mt-6 space-y-3 text-sm font-bold text-slate-300">
              <p>✅ Pesquisa específica para sua rota e datas.</p>
              <p>✅ Dá para considerar bagagem, crianças e flexibilidade.</p>
              <p>✅ Menos busca automática e mais foco em quem realmente quer comprar.</p>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                Pedir cotação
              </p>
              <h3 className="mt-1 text-2xl font-black">
                Me passe sua viagem e eu continuo no WhatsApp
              </h3>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Saindo de *
                <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: Porto Alegre" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none focus:border-sky-400 focus:bg-white" />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Indo para *
                <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex.: Miami" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none focus:border-sky-400 focus:bg-white" />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Ida
                <input type="date" value={ida} onChange={(e) => setIda(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none focus:border-sky-400 focus:bg-white" />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Volta
                <input type="date" value={volta} onChange={(e) => setVolta(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none focus:border-sky-400 focus:bg-white" />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Adultos
                <select value={adultos} onChange={(e) => setAdultos(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none">
                  {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Crianças
                <select value={criancas} onChange={(e) => setCriancas(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none">
                  {[0,1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Bagagem
                <select value={bagagem} onChange={(e) => setBagagem(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none">
                  <option>A decidir</option>
                  <option>Somente item pessoal</option>
                  <option>Bagagem de mão</option>
                  <option>Bagagem despachada</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                Flexibilidade
                <select value={flexibilidade} onChange={(e) => setFlexibilidade(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-bold outline-none">
                  <option>Datas exatas</option>
                  <option>± 1 dia</option>
                  <option>± 3 dias</option>
                  <option>Datas bem flexíveis</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                Orçamento aproximado
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                  <input inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="Opcional" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-bold outline-none focus:border-sky-400 focus:bg-white" />
                </div>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                Observações
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Ex.: prefiro voo noturno, sem escala longa, criança de 5 anos..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-medium outline-none focus:border-sky-400 focus:bg-white" />
              </label>
            </div>

            <button type="button" onClick={enviar} disabled={!podeEnviar} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              💬 Pedir cotação pelo WhatsApp
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              A pesquisa do voo é feita sob demanda. Pacotes, ingressos e outras ofertas continuam disponíveis normalmente no site.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
