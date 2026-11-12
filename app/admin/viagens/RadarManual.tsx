"use client";

import { useMemo, useState } from "react";

const ROTAS = [
  ["poa-orlando", "Porto Alegre → Orlando"],
  ["poa-new-york", "Porto Alegre → Nova York"],
  ["poa-miami", "Porto Alegre → Miami"],
  ["poa-los-angeles", "Porto Alegre → Los Angeles"],
  ["poa-lisboa", "Porto Alegre → Lisboa"],
  ["gru-orlando", "São Paulo → Orlando"],
  ["gru-new-york", "São Paulo → Nova York"],
  ["gru-miami", "São Paulo → Miami"],
  ["gru-los-angeles", "São Paulo → Los Angeles"],
  ["gru-lisboa", "São Paulo → Lisboa"],
  ["gru-madrid", "São Paulo → Madrid"],
  ["gig-orlando", "Rio de Janeiro → Orlando"],
  ["gig-new-york", "Rio de Janeiro → Nova York"],
  ["gig-miami", "Rio de Janeiro → Miami"],
  ["gig-los-angeles", "Rio de Janeiro → Los Angeles"],
  ["gig-lisboa", "Rio de Janeiro → Lisboa"],
] as const;

export default function RadarManual() {
  const hoje = new Date();
  const mesPadrao = `${hoje.getFullYear()}-${String(hoje.getMonth() + 2).padStart(2, "0")}`;

  const [slug, setSlug] = useState("poa-orlando");
  const [mes, setMes] = useState(mesPadrao);
  const [dia, setDia] = useState("");
  const [limite, setLimite] = useState("3");
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState("");

  const rotaNome = useMemo(
    () => ROTAS.find(([valor]) => valor === slug)?.[1] || slug,
    [slug]
  );

  async function executar() {
    setCarregando(true);
    setErro("");
    setResultado(null);

    try {
      const resposta = await fetch("/api/admin/viagens/radar/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          mes,
          dia: dia ? Number(dia) : null,
          limite: Number(limite),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados?.sucesso) {
        throw new Error(
          dados?.erro ||
            dados?.dados?.erro ||
            "A pesquisa manual não pôde ser concluída."
        );
      }

      setResultado(dados.dados);
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro inesperado na pesquisa."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Modo econômico
          </p>
          <h2 className="mt-1 text-2xl font-black">
            🔎 Pesquisa manual de voo
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            O Radar automático está pausado. Use esta área só quando houver uma
            solicitação real de cliente. Cada execução abaixo pode consumir
            consultas da Ignav.
          </p>
        </div>

        <span className="w-fit rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
          Automação paga: PAUSADA
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-2 text-sm font-black text-slate-700 xl:col-span-2">
          Rota
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          >
            {ROTAS.map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-black text-slate-700">
          Mês
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-slate-700">
          Dia preferido
          <input
            type="number"
            min="1"
            max="31"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            placeholder="Opcional"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-slate-700">
          Consultas
          <select
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          >
            <option value="1">1</option>
            <option value="3">3</option>
            <option value="5">5</option>
            <option value="8">8</option>
            <option value="12">12</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={executar}
        disabled={carregando || !mes}
        className="mt-5 rounded-xl bg-emerald-600 px-6 py-3 font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {carregando ? "Pesquisando..." : `Pesquisar ${rotaNome}`}
      </button>

      {erro ? (
        <p className="mt-4 rounded-xl bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </p>
      ) : null}

      {resultado ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs font-black">
              Consultas: {Number(resultado.consultas || 0)}
            </span>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-black">
              Gravadas: {Number(resultado.observacoes_gravadas || 0)}
            </span>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-black">
              Status: {String(resultado.status || "concluído")}
            </span>
          </div>

          {Array.isArray(resultado.oportunidades) &&
          resultado.oportunidades.length > 0 ? (
            <div className="mt-4 space-y-3">
              {resultado.oportunidades.slice(0, 5).map((item: any, index: number) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
                >
                  <strong>
                    {item.ida || "—"} → {item.volta || "—"}
                  </strong>
                  {item.preco_por_pessoa ? (
                    <span className="ml-3 font-black text-emerald-700">
                      R$ {Number(item.preco_por_pessoa).toLocaleString("pt-BR")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              A execução terminou. Consulte o histórico/status dos radares abaixo
              para ver os valores gravados.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
