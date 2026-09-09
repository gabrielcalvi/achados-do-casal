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
};

type Etapa = {
  id: number;
  parceiro_id: string;
  etapa: string;
  concluido: boolean;
  ordem: number;
};

type Resposta = {
  sucesso?: boolean;
  erro?: string;
  parceiros?: Parceiro[];
  checklist?: Etapa[];
};

const statusRotulos: Record<Parceiro["status"], string> = {
  ativo: "Ativo",
  pendente: "Aguardando",
  acao: "Precisa de ação",
  alvo: "Próximo alvo",
  pausado: "Pausado",
  recusado: "Recusado",
};

const statusClasse: Record<Parceiro["status"], string> = {
  ativo: "border-emerald-200 bg-emerald-50 text-emerald-800",
  pendente: "border-amber-200 bg-amber-50 text-amber-900",
  acao: "border-red-200 bg-red-50 text-red-800",
  alvo: "border-sky-200 bg-sky-50 text-sky-800",
  pausado: "border-slate-200 bg-slate-100 text-slate-700",
  recusado: "border-rose-200 bg-rose-50 text-rose-800",
};

const statusRapidoClasse: Record<Parceiro["status"], string> = {
  ativo: "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600",
  pendente: "border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500",
  acao: "border-red-600 bg-red-500 text-white hover:bg-red-600",
  alvo: "border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500",
  pausado: "border-amber-500 bg-amber-400 text-amber-950 hover:bg-amber-500",
  recusado: "border-red-600 bg-red-500 text-white hover:bg-red-600",
};

const ordemStatusRapido: Record<Parceiro["status"], number> = {
  acao: 0,
  recusado: 1,
  pendente: 2,
  pausado: 3,
  alvo: 4,
  ativo: 5,
};

function comissao(parceiro: Parceiro) {
  if (parceiro.comissao_texto) return parceiro.comissao_texto;
  if (parceiro.comissao_valor === null) return "A confirmar";
  if (parceiro.comissao_tipo === "percentual") return `${parceiro.comissao_valor}%`;
  if (parceiro.comissao_tipo === "fixa") return `R$ ${parceiro.comissao_valor.toFixed(2)}`;
  return String(parceiro.comissao_valor);
}

function comissaoPercentualRapida(parceiro: Parceiro) {
  const texto = String(parceiro.comissao_texto || "");
  const encontrada = texto.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (encontrada?.[1]) return `${encontrada[1].replace(".", ",")}%`;

  if (parceiro.comissao_tipo === "percentual" && parceiro.comissao_valor !== null) {
    return `${String(parceiro.comissao_valor).replace(".", ",")}%`;
  }

  return null;
}

export default function AdminParceirosPage() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [checklist, setChecklist] = useState<Etapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Parceiro | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch("/api/admin/parceiros", { cache: "no-store" });
      const dados = (await resposta.json()) as Resposta;
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao carregar parceiros.");
      setParceiros(dados.parceiros || []);
      setChecklist(dados.checklist || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const resumo = useMemo(() => ({
    ativos: parceiros.filter((p) => p.status === "ativo").length,
    acao: parceiros.filter((p) => p.status === "acao").length,
    pendentes: parceiros.filter((p) => p.status === "pendente").length,
    alvos: parceiros.filter((p) => p.status === "alvo").length,
  }), [parceiros]);

  const parceirosVisaoRapida = useMemo(() => (
    [...parceiros].sort((a, b) => {
      const porStatus = ordemStatusRapido[a.status] - ordemStatusRapido[b.status];
      if (porStatus !== 0) return porStatus;
      const porPrioridade = a.prioridade - b.prioridade;
      if (porPrioridade !== 0) return porPrioridade;
      return a.nome.localeCompare(b.nome, "pt-BR");
    })
  ), [parceiros]);

  async function alternarEtapa(etapa: Etapa) {
    const resposta = await fetch("/api/admin/parceiros/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: etapa.id, concluido: !etapa.concluido }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) return alert(dados.erro || "Falha ao atualizar etapa.");
    setChecklist((atual) => atual.map((item) => item.id === etapa.id ? { ...item, concluido: !item.concluido } : item));
  }

  async function salvar(parceiro: Partial<Parceiro>, criando = false) {
    const resposta = await fetch("/api/admin/parceiros", {
      method: criando ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parceiro),
    });
    const dados = await resposta.json();
    if (!resposta.ok) return alert(dados.erro || "Falha ao salvar parceiro.");
    setEditando(null);
    setNovoAberto(false);
    await carregar();
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-pink-500">Achados do Casal</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Parceiros & Afiliados</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Painel de controle das redes, comissões, integrações, pendências e próximos alvos.</p>
            </div>
            <button onClick={() => setNovoAberto(true)} className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800">+ Novo parceiro</button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Resumo titulo="Ativos" valor={resumo.ativos} detalhe="Parcerias em operação" />
            <Resumo titulo="Precisam de ação" valor={resumo.acao} detalhe="Algo depende de nós" />
            <Resumo titulo="Aguardando" valor={resumo.pendentes} detalhe="Aprovação ou retorno" />
            <Resumo titulo="Próximos alvos" valor={resumo.alvos} detalhe="Fila de expansão" />
          </div>
        </header>

        {!carregando && parceiros.length ? (
          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Visão rápida</p>
                <h2 className="mt-1 text-xl font-black">Status geral dos parceiros</h2>
                <p className="mt-1 text-sm text-slate-500">Todos os afiliados em uma única foto. Clique no status para abrir o parceiro.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-black text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Ativo</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Aguardando / andamento</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Ação / problema</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {parceirosVisaoRapida.map((parceiro) => {
                const percentualComissao = comissaoPercentualRapida(parceiro);

                return (
                  <div key={parceiro.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900" title={parceiro.nome}>{parceiro.nome}</p>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-slate-400" title={parceiro.rede || ""}>{parceiro.rede || "Rede a confirmar"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {percentualComissao ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-black text-slate-700" title="Comissão cadastrada">
                          {percentualComissao}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditando(parceiro)}
                        className={`rounded-full border px-2.5 py-1.5 text-[10px] font-black transition ${statusRapidoClasse[parceiro.status]}`}
                        title={`Abrir ${parceiro.nome}`}
                      >
                        {statusRotulos[parceiro.status]}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {erro ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{erro}</div> : null}

        <section className="mt-6 space-y-4">
          {carregando ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-500">Carregando parceiros...</div>
          ) : parceiros.map((parceiro) => {
            const etapas = checklist.filter((item) => item.parceiro_id === parceiro.id).sort((a,b) => a.ordem - b.ordem);
            const concluidas = etapas.filter((item) => item.concluido).length;
            const progresso = etapas.length ? Math.round((concluidas / etapas.length) * 100) : 0;

            return (
              <article key={parceiro.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black">{parceiro.nome}</h2>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasse[parceiro.status]}`}>{statusRotulos[parceiro.status]}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">P{parceiro.prioridade}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Info rotulo="Rede" valor={parceiro.rede || "A confirmar"} />
                      <Info rotulo="Comissão" valor={comissao(parceiro)} />
                      <Info rotulo="Automação" valor={parceiro.automacao_status.replace("_", " ")} />
                      <Info rotulo="Integrações" valor={parceiro.integracoes.length ? parceiro.integracoes.join(" · ") : "Ainda não integrada"} />
                    </div>

                    {parceiro.pendencia ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900"><strong>Pendência:</strong> {parceiro.pendencia}</p> : null}
                    {parceiro.proximo_passo ? <p className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900"><strong>Próximo passo:</strong> {parceiro.proximo_passo}</p> : null}
                  </div>

                  <div className="w-full shrink-0 xl:w-[330px]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black">Checklist</p>
                      <span className="text-xs font-black text-slate-500">{progresso}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${progresso}%` }} /></div>
                    <div className="mt-3 space-y-2">
                      {etapas.map((etapa) => (
                        <button key={etapa.id} onClick={() => alternarEtapa(etapa)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                          <span className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-black ${etapa.concluido ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                          <span className={etapa.concluido ? "text-slate-400 line-through" : "font-bold text-slate-700"}>{etapa.etapa}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setEditando(parceiro)} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Editar parceiro</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {(editando || novoAberto) ? (
        <Editor parceiro={editando} criando={novoAberto} onCancelar={() => { setEditando(null); setNovoAberto(false); }} onSalvar={salvar} />
      ) : null}
    </main>
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: number; detalhe: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{titulo}</p><p className="mt-1 text-3xl font-black">{valor}</p><p className="mt-1 text-xs font-bold text-slate-500">{detalhe}</p></div>;
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{rotulo}</p><p className="mt-1 text-sm font-black text-slate-800">{valor}</p></div>;
}

function Editor({ parceiro, criando, onCancelar, onSalvar }: { parceiro: Parceiro | null; criando: boolean; onCancelar: () => void; onSalvar: (p: Partial<Parceiro>, criando?: boolean) => void }) {
  const [form, setForm] = useState<Partial<Parceiro>>(parceiro || {
    nome: "", rede: "", status: "alvo", comissao_tipo: "desconhecida", comissao_texto: "A confirmar",
    integracoes: [], automacao_status: "nao_integrada", prioridade: 3, pendencia: "", proximo_passo: "", observacoes: "",
  });

  function alterar(campo: keyof Parceiro, valor: any) { setForm((atual) => ({ ...atual, [campo]: valor })); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">{criando ? "Novo parceiro" : `Editar ${parceiro?.nome}`}</h2><button onClick={onCancelar} className="text-2xl">×</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Campo rotulo="Parceiro" valor={String(form.nome || "")} onChange={(v) => alterar("nome", v)} />
          <Campo rotulo="Rede / plataforma" valor={String(form.rede || "")} onChange={(v) => alterar("rede", v)} />
          <Select rotulo="Status" valor={String(form.status || "alvo")} onChange={(v) => alterar("status", v)} opcoes={[["ativo","Ativo"],["pendente","Aguardando"],["acao","Precisa de ação"],["alvo","Próximo alvo"],["pausado","Pausado"],["recusado","Recusado"]]} />
          <Select rotulo="Automação" valor={String(form.automacao_status || "nao_integrada")} onChange={(v) => alterar("automacao_status", v)} opcoes={[["ativa","Ativa"],["parcial","Parcial"],["manual","Manual"],["nao_integrada","Não integrada"]]} />
          <Select rotulo="Tipo de comissão" valor={String(form.comissao_tipo || "desconhecida")} onChange={(v) => alterar("comissao_tipo", v)} opcoes={[["percentual","Percentual"],["fixa","Fixa"],["variavel","Variável"],["desconhecida","Desconhecida"]]} />
          <Campo rotulo="Comissão / regra" valor={String(form.comissao_texto || "")} onChange={(v) => alterar("comissao_texto", v)} />
          <Campo rotulo="Prioridade (1 a 5)" tipo="number" valor={String(form.prioridade || 3)} onChange={(v) => alterar("prioridade", Number(v))} />
          <Campo rotulo="Integrações (separadas por vírgula)" valor={(form.integracoes || []).join(", ")} onChange={(v) => alterar("integracoes", v.split(",").map((x) => x.trim()).filter(Boolean))} />
          <Campo rotulo="Painel URL" valor={String(form.painel_url || "")} onChange={(v) => alterar("painel_url", v)} />
          <Campo rotulo="Programa URL" valor={String(form.programa_url || "")} onChange={(v) => alterar("programa_url", v)} />
        </div>
        <div className="mt-4 space-y-4">
          <Area rotulo="Pendência" valor={String(form.pendencia || "")} onChange={(v) => alterar("pendencia", v)} />
          <Area rotulo="Próximo passo" valor={String(form.proximo_passo || "")} onChange={(v) => alterar("proximo_passo", v)} />
          <Area rotulo="Observações" valor={String(form.observacoes || "")} onChange={(v) => alterar("observacoes", v)} />
        </div>
        <div className="mt-6 flex justify-end gap-3"><button onClick={onCancelar} className="rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700">Cancelar</button><button onClick={() => onSalvar({ ...form, ...(parceiro?.id ? { id: parceiro.id } : {}) }, criando)} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Salvar</button></div>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor, onChange, tipo = "text" }: { rotulo: string; valor: string; onChange: (v: string) => void; tipo?: string }) {
  return <label className="block"><span className="text-xs font-black uppercase text-slate-500">{rotulo}</span><input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500" /></label>;
}

function Area({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return <label className="block"><span className="text-xs font-black uppercase text-slate-500">{rotulo}</span><textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500" /></label>;
}

function Select({ rotulo, valor, onChange, opcoes }: { rotulo: string; valor: string; onChange: (v: string) => void; opcoes: [string,string][] }) {
  return <label className="block"><span className="text-xs font-black uppercase text-slate-500">{rotulo}</span><select value={valor} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-500">{opcoes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}