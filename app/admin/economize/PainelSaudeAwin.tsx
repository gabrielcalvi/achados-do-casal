"use client";

import { useEffect, useMemo, useState } from "react";

type Estado = "ok" | "atencao" | "erro";

type LojaSaude = {
  slug: string;
  nome: string;
  estado: Estado;
  mensagem: string;
  executar_path: string;
  ultima_execucao: string | null;
  horas_desde_execucao: number | null;
  feed: {
    disponivel: boolean | null;
    feeds_encontrados: number | null;
    feeds_lidos: number | null;
    total: number | null;
    elegiveis: number | null;
    selecionados: number | null;
    links_ok: number | null;
    links_falha: number | null;
    criadas: number | null;
    atualizadas: number | null;
    expiradas: number | null;
    erro: string | null;
  };
  banco: {
    ativos: number;
    pendentes: number;
    total: number;
    ultima_atualizacao: string | null;
  };
  parceiro: {
    status: string;
    rede: string;
    integracoes: string[];
    automacao_status: string;
    pendencia: string | null;
    proximo_passo: string | null;
  } | null;
};

type Resposta = {
  sucesso?: boolean;
  erro?: string;
  atualizado_em?: string;
  lojas?: LojaSaude[];
};

const visual: Record<Estado, { rotulo: string; icone: string; classe: string }> = {
  ok: {
    rotulo: "Saudável",
    icone: "🟢",
    classe: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  atencao: {
    rotulo: "Atenção",
    icone: "🟡",
    classe: "border-amber-200 bg-amber-50 text-amber-800",
  },
  erro: {
    rotulo: "Erro",
    icone: "🔴",
    classe: "border-red-200 bg-red-50 text-red-800",
  },
};

function dataHora(valor: string | null) {
  if (!valor) return "Nunca";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function numero(valor: number | null | undefined) {
  return valor === null || valor === undefined ? "—" : valor.toLocaleString("pt-BR");
}

export default function PainelSaudeAwin() {
  const [lojas, setLojas] = useState<LojaSaude[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [executando, setExecutando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  async function carregar() {
    try {
      setErro("");
      const resposta = await fetch("/api/admin/economize/awin/saude", { cache: "no-store" });
      const dados = (await resposta.json()) as Resposta;
      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao carregar saúde AWIN.");
      }
      setLojas(dados.lojas ?? []);
      setAtualizadoEm(dados.atualizado_em ?? null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar saúde AWIN.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const resumo = useMemo(
    () => ({
      ok: lojas.filter((loja) => loja.estado === "ok").length,
      atencao: lojas.filter((loja) => loja.estado === "atencao").length,
      erro: lojas.filter((loja) => loja.estado === "erro").length,
    }),
    [lojas]
  );

  async function executarAgora(loja: LojaSaude) {
    try {
      setExecutando(loja.slug);
      setErro("");
      setAviso("");

      const resposta = await fetch(loja.executar_path, {
        method: "POST",
        cache: "no-store",
      });
      const dados = await resposta.json();

      if (!resposta.ok || dados.sucesso === false) {
        throw new Error(dados.erro || `Falha ao iniciar coleta de ${loja.nome}.`);
      }

      setAviso(
        `${loja.nome}: coleta iniciada. O painel atualizará os números após a conclusão do coletor.`
      );
      window.setTimeout(() => void carregar(), 3000);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao iniciar coleta AWIN.");
    } finally {
      setExecutando(null);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-indigo-600">
            Operação AWIN
          </p>
          <h2 className="mt-2 text-2xl font-black">Saúde dos catálogos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Usa os mesmos coletores, watchdog e dados reais do Supabase. Aqui dá para enxergar rapidamente
            se cada loja está alimentando a vitrine, quantos produtos o feed trouxe e onde a execução parou.
          </p>
          {atualizadoEm && (
            <p className="mt-2 text-xs font-bold text-slate-400">
              Painel atualizado em {dataHora(atualizadoEm)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          🔄 Atualizar painel
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="text-xs font-black uppercase">🟢 Saudáveis</p>
          <p className="mt-2 text-3xl font-black">{resumo.ok}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-xs font-black uppercase">🟡 Atenção</p>
          <p className="mt-2 text-3xl font-black">{resumo.atencao}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="text-xs font-black uppercase">🔴 Erro</p>
          <p className="mt-2 text-3xl font-black">{resumo.erro}</p>
        </div>
      </div>

      {aviso && (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-800">
          {aviso}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-black">Loja</th>
              <th className="px-4 py-3 font-black">Saúde</th>
              <th className="px-4 py-3 font-black">Última execução</th>
              <th className="px-4 py-3 font-black">Feed</th>
              <th className="px-4 py-3 font-black">Elegíveis</th>
              <th className="px-4 py-3 font-black">Selecionados</th>
              <th className="px-4 py-3 font-black">Publicação</th>
              <th className="px-4 py-3 font-black">Vitrine</th>
              <th className="px-4 py-3 font-black">Ação</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Carregando saúde AWIN...
                </td>
              </tr>
            ) : (
              lojas.map((loja) => {
                const estilo = visual[loja.estado] || visual.atencao;
                return (
                  <tr key={loja.slug} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{loja.nome}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{loja.slug}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${estilo.classe}`}>
                        {estilo.icone} {estilo.rotulo}
                      </span>
                      <p className="mt-2 max-w-56 text-xs leading-5 text-slate-500">{loja.mensagem}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-700">{dataHora(loja.ultima_execucao)}</p>
                      {loja.horas_desde_execucao !== null && (
                        <p className="mt-1 text-xs text-slate-400">
                          há {loja.horas_desde_execucao.toFixed(1).replace(".", ",")}h
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{numero(loja.feed.total)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {numero(loja.feed.feeds_lidos)}/{numero(loja.feed.feeds_encontrados)} feed(s)
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{numero(loja.feed.elegiveis)}</p>
                      <p className="mt-1 text-xs text-slate-400">após regras da loja</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{numero(loja.feed.selecionados)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        links OK: {numero(loja.feed.links_ok)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-emerald-700">+{numero(loja.feed.criadas)} novas</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {numero(loja.feed.atualizadas)} atualizadas · {numero(loja.feed.expiradas)} expiradas
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{loja.banco.ativos} ativas</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {loja.banco.pendentes} pendentes · {loja.banco.total} total
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void executarAgora(loja)}
                        disabled={Boolean(executando)}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {executando === loja.slug ? "▶️ Iniciando..." : "▶️ Executar agora"}
                      </button>
                      {loja.feed.erro && (
                        <p className="mt-2 max-w-48 text-xs font-bold text-red-600">{loja.feed.erro}</p>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
