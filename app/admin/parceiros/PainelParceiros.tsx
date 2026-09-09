"use client";

import { useEffect, useMemo, useState } from "react";

type Parceiro = {
  id: string;
  nome: string;
  slug: string;
  rede: string | null;
  status: "ativo" | "pendente" | "acao" | "alvo" | "pausado" | "recusado";
  comissao_tipo: "percentual" | "fixa" | "variavel" | "desconhecida";
  comissao_valor: number | null;
  comissao_texto: string | null;
  integracoes: string[];
  automacao_status: "ativa" | "parcial" | "manual" | "nao_integrada";
  painel_url: string | null;
  programa_url: string | null;
  pendencia: string | null;
  proximo_passo: string | null;
  prioridade: number;
  observacoes: string | null;
  updated_at: string;
};

type Etapa = {
  id: number;
  parceiro_id: string;
  etapa: string;
  concluido: boolean;
  ordem: number;
};

const statusInfo = {
  ativo: ["Ativo", "bg-emerald-100 text-emerald-800"],
  pendente: ["Aguardando", "bg-amber-100 text-amber-800"],
  acao: ["Precisa de ação", "bg-red-100 text-red-800"],
  alvo: ["Próximo alvo", "bg-sky-100 text-sky-800"],
  pausado: ["Pausado", "bg-slate-200 text-slate-700"],
  recusado: ["Recusado", "bg-rose-100 text-rose-800"],
} as const;

const automacaoInfo = {
  ativa: "Automação ativa",
  parcial: "Automação parcial",
  manual: "Manual",
  nao_integrada: "Não integrada",
} as const;

const parceiroVazio: Partial<Parceiro> = {
  nome: "",
  rede: "",
  status: "alvo",
  comissao_tipo: "desconhecida",
  comissao_valor: null,
  comissao_texto: "A confirmar",
  integracoes: [],
  automacao_status: "nao_integrada",
  painel_url: "",
  programa_url: "",
  pendencia: "",
  proximo_passo: "",
  prioridade: 3,
  observacoes: "",
};

export default function PainelParceiros() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [checklist, setChecklist] = useState<Etapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<Parceiro> | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch("/api/admin/parceiros", { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao carregar parceiros.");
      setParceiros(dados.parceiros || []);
      setChecklist(dados.checklist || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const contagens = useMemo(() => ({
    ativo: parceiros.filter((p) => p.status === "ativo").length,
    acao: parceiros.filter((p) => p.status === "acao").length,
    pendente: parceiros.filter((p) => p.status === "pendente").length,
    alvo: parceiros.filter((p) => p.status === "alvo").length,
  }), [parceiros]);

  const filtrados = useMemo(() => parceiros.filter((p) => {
    const statusOk = filtro === "todos" || p.status === filtro;
    const termo = busca.trim().toLowerCase();
    const buscaOk = !termo || `${p.nome} ${p.rede || ""} ${p.pendencia || ""} ${p.proximo_passo || ""}`.toLowerCase().includes(termo);
    return statusOk && buscaOk;
  }), [parceiros, filtro, busca]);

  async function alternarEtapa(etapa: Etapa) {
    const novo = !etapa.concluido;
    setChecklist((atual) => atual.map((x) => x.id === etapa.id ? { ...x, concluido: novo } : x));
    const resposta = await fetch("/api/admin/parceiros/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: etapa.id, concluido: novo }),
    });
    if (!resposta.ok) await carregar();
  }

  async function salvar() {
    if (!editando?.nome?.trim()) return alert("Informe o nome do parceiro.");
    try {
      setSalvando(true);
      const novo = !editando.id;
      const resposta = await fetch("/api/admin/parceiros", {
        method: novo ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editando),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao salvar parceiro.");
      setEditando(null);
      await carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function formatarComissao(p: Parceiro) {
    if (p.comissao_texto) return p.comissao_texto;
    if (p.comissao_tipo === "percentual" && p.comissao_valor !== null) return `${p.comissao_valor}%`;
    if (p.comissao_tipo === "fixa" && p.comissao_valor !== null) return `R$ ${p.comissao_valor.toFixed(2)}`;
    return "A confirmar";
  }

  if (carregando) return <div className="rounded-3xl bg-white p-8 font-bold shadow-sm">Carregando parceiros...</div>;
  if (erro) return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-800">{erro}</div>;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Ativos", contagens.ativo, "text-emerald-700"],
          ["Precisam de ação", contagens.acao, "text-red-700"],
          ["Aguardando", contagens.pendente, "text-amber-700"],
          ["Próximos alvos", contagens.alvo, "text-sky-700"],
        ].map(([rotulo, valor, cor]) => (
          <div key={String(rotulo)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{rotulo}</p>
            <p className={`mt-2 text-4xl font-black ${cor}`}>{valor}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar parceiro, rede ou pendência..." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500" />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 font-bold">
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="acao">Precisam de ação</option>
              <option value="pendente">Aguardando</option>
              <option value="alvo">Próximos alvos</option>
              <option value="pausado">Pausados</option>
              <option value="recusado">Recusados</option>
            </select>
          </div>
          <button onClick={() => setEditando({ ...parceiroVazio })} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white hover:bg-slate-800">+ Novo parceiro</button>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        {filtrados.map((p) => {
          const etapas = checklist.filter((x) => x.parceiro_id === p.id).sort((a, b) => a.ordem - b.ordem);
          const feitas = etapas.filter((x) => x.concluido).length;
          const progresso = etapas.length ? Math.round((feitas / etapas.length) * 100) : 0;
          const [rotuloStatus, classeStatus] = statusInfo[p.status];
          return (
            <article key={p.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{p.nome}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${classeStatus}`}>{rotuloStatus}</span>
                    {p.prioridade <= 2 ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800">Prioridade {p.prioridade}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.rede || "Rede a confirmar"}</p>
                </div>
                <button onClick={() => setEditando({ ...p })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black hover:bg-slate-50">Editar</button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Comissão</p><p className="mt-1 font-black">{formatarComissao(p)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Operação</p><p className="mt-1 font-black">{automacaoInfo[p.automacao_status]}</p></div>
              </div>

              {p.integracoes?.length ? <div className="mt-3 flex flex-wrap gap-2">{p.integracoes.map((i) => <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{i}</span>)}</div> : null}

              {p.pendencia ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-700">Pendência</p><p className="mt-1 text-sm font-bold text-amber-950">{p.pendencia}</p></div> : null}
              {p.proximo_passo ? <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-black uppercase text-sky-700">Próximo passo</p><p className="mt-1 text-sm font-bold text-sky-950">{p.proximo_passo}</p></div> : null}

              <div className="mt-5">
                <div className="flex items-center justify-between"><p className="font-black">Checklist</p><span className="text-xs font-black text-slate-500">{feitas}/{etapas.length} · {progresso}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progresso}%` }} /></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {etapas.map((etapa) => (
                    <label key={etapa.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={etapa.concluido} onChange={() => alternarEtapa(etapa)} className="mt-0.5 h-4 w-4" />
                      <span className={etapa.concluido ? "text-slate-400 line-through" : "font-bold text-slate-700"}>{etapa.etapa}</span>
                    </label>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {editando ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4 sm:p-8">
          <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-black">{editando.id ? `Editar ${editando.nome}` : "Novo parceiro"}</h2><button onClick={() => setEditando(null)} className="rounded-lg border px-3 py-2 font-black">✕</button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Campo label="Parceiro"><input value={editando.nome || ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="campo" /></Campo>
              <Campo label="Rede / plataforma"><input value={editando.rede || ""} onChange={(e) => setEditando({ ...editando, rede: e.target.value })} placeholder="AWIN, Lomadee, CJ..." className="campo" /></Campo>
              <Campo label="Status"><select value={editando.status || "alvo"} onChange={(e) => setEditando({ ...editando, status: e.target.value as Parceiro["status"] })} className="campo"><option value="ativo">Ativo</option><option value="acao">Precisa de ação</option><option value="pendente">Aguardando</option><option value="alvo">Próximo alvo</option><option value="pausado">Pausado</option><option value="recusado">Recusado</option></select></Campo>
              <Campo label="Prioridade"><select value={editando.prioridade || 3} onChange={(e) => setEditando({ ...editando, prioridade: Number(e.target.value) })} className="campo">{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} {n === 1 ? "— máxima" : n === 5 ? "— baixa" : ""}</option>)}</select></Campo>
              <Campo label="Tipo de comissão"><select value={editando.comissao_tipo || "desconhecida"} onChange={(e) => setEditando({ ...editando, comissao_tipo: e.target.value as Parceiro["comissao_tipo"] })} className="campo"><option value="desconhecida">Desconhecida</option><option value="percentual">Percentual</option><option value="fixa">Fixa</option><option value="variavel">Variável</option></select></Campo>
              <Campo label="Comissão / regra"><input value={editando.comissao_texto || ""} onChange={(e) => setEditando({ ...editando, comissao_texto: e.target.value })} placeholder="Ex.: 4%, R$ 25 ou varia por categoria" className="campo" /></Campo>
              <Campo label="Automação"><select value={editando.automacao_status || "nao_integrada"} onChange={(e) => setEditando({ ...editando, automacao_status: e.target.value as Parceiro["automacao_status"] })} className="campo"><option value="ativa">Ativa</option><option value="parcial">Parcial</option><option value="manual">Manual</option><option value="nao_integrada">Não integrada</option></select></Campo>
              <Campo label="Integrações (separadas por vírgula)"><input value={(editando.integracoes || []).join(", ")} onChange={(e) => setEditando({ ...editando, integracoes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="campo" /></Campo>
              <Campo label="URL do painel"><input value={editando.painel_url || ""} onChange={(e) => setEditando({ ...editando, painel_url: e.target.value })} className="campo" /></Campo>
              <Campo label="URL do programa"><input value={editando.programa_url || ""} onChange={(e) => setEditando({ ...editando, programa_url: e.target.value })} className="campo" /></Campo>
              <div className="sm:col-span-2"><Campo label="Pendência atual"><textarea value={editando.pendencia || ""} onChange={(e) => setEditando({ ...editando, pendencia: e.target.value })} rows={2} className="campo" /></Campo></div>
              <div className="sm:col-span-2"><Campo label="Próximo passo"><textarea value={editando.proximo_passo || ""} onChange={(e) => setEditando({ ...editando, proximo_passo: e.target.value })} rows={2} className="campo" /></Campo></div>
              <div className="sm:col-span-2"><Campo label="Observações"><textarea value={editando.observacoes || ""} onChange={(e) => setEditando({ ...editando, observacoes: e.target.value })} rows={3} className="campo" /></Campo></div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditando(null)} className="rounded-xl border border-slate-300 px-5 py-3 font-black">Cancelar</button><button disabled={salvando} onClick={salvar} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar parceiro"}</button></div>
          </div>
          <style jsx global>{`.campo{width:100%;border:1px solid rgb(203 213 225);border-radius:.75rem;padding:.75rem 1rem;outline:none;background:white}.campo:focus{border-color:rgb(71 85 105)}`}</style>
        </div>
      ) : null}
    </>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}
