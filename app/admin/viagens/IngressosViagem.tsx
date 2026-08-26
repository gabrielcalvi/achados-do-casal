"use client";

import { useEffect, useMemo, useState } from "react";

type Ingresso = {
  id: string;
  status: string;
  titulo: string;
  parceiro: string;
  link_original?: string | null;
  link_afiliado: string;
  atracao_nome: string;
  cidade_uf?: string | null;
  data_uso?: string | null;
  adultos: number;
  criancas: number;
  preco_total: number;
  preco_por_pessoa?: number | null;
  moeda: string;
  imagem_url?: string | null;
  observacoes?: string | null;
  validade?: string | null;
  destaque: boolean;
};

const INICIAL = {
  titulo: "",
  parceiro: "Decolar",
  link_original: "",
  link_afiliado: "",
  atracao_nome: "",
  cidade_uf: "",
  data_uso: "",
  adultos: "1",
  criancas: "0",
  preco_total: "",
  preco_por_pessoa: "",
  moeda: "BRL",
  imagem_url: "",
  observacoes: "",
  validade: "",
  destaque: false,
  status: "rascunho",
};

function moeda(valor: number | null | undefined, codigo = "BRL") {
  if (!Number.isFinite(Number(valor))) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: codigo,
  }).format(Number(valor));
}

function dataInput(valor?: string | null) {
  return valor ? valor.slice(0, 10) : "";
}

export default function IngressosViagem() {
  const [ingressos, setIngressos] = useState<Ingresso[]>([]);
  const [form, setForm] = useState(INICIAL);
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const ativos = useMemo(
    () => ingressos.filter((item) => item.status === "ativo").length,
    [ingressos]
  );

  function alterar(nome: keyof typeof INICIAL, valor: string | boolean) {
    setForm((atual) => ({ ...atual, [nome]: valor }));
  }

  async function carregar() {
    try {
      setCarregando(true);
      const resposta = await fetch("/api/admin/viagens/ingressos", { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao carregar ingressos.");
      setIngressos(dados.ingressos ?? []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar ingressos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function novo() {
    setEditandoId(null);
    setForm(INICIAL);
    setErro("");
    setAviso("");
    setAberto(true);
  }

  function editar(item: Ingresso) {
    setEditandoId(item.id);
    setForm({
      titulo: item.titulo || "",
      parceiro: item.parceiro || "Decolar",
      link_original: item.link_original || "",
      link_afiliado: item.link_afiliado || "",
      atracao_nome: item.atracao_nome || "",
      cidade_uf: item.cidade_uf || "",
      data_uso: dataInput(item.data_uso),
      adultos: String(item.adultos ?? 1),
      criancas: String(item.criancas ?? 0),
      preco_total: String(item.preco_total ?? ""),
      preco_por_pessoa: item.preco_por_pessoa != null ? String(item.preco_por_pessoa) : "",
      moeda: item.moeda || "BRL",
      imagem_url: item.imagem_url || "",
      observacoes: item.observacoes || "",
      validade: dataInput(item.validade),
      destaque: Boolean(item.destaque),
      status: item.status || "rascunho",
    });
    setAberto(true);
    setAviso(`Editando ingresso: ${item.titulo}`);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    try {
      setSalvando(true);
      setErro("");
      setAviso("");

      const payload = {
        ...form,
        ...(editandoId ? { id: editandoId } : {}),
        adultos: Number(form.adultos),
        criancas: Number(form.criancas),
        preco_total: Number(form.preco_total),
        preco_por_pessoa: form.preco_por_pessoa ? Number(form.preco_por_pessoa) : null,
        validade: form.validade ? new Date(form.validade).toISOString() : null,
      };

      const resposta = await fetch("/api/admin/viagens/ingressos", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao salvar ingresso.");

      setForm(INICIAL);
      setEditandoId(null);
      setAberto(false);
      await carregar();
      setAviso(editandoId ? "Ingresso atualizado." : "Ingresso cadastrado com sucesso.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao salvar ingresso.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-fuchsia-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-fuchsia-600">Ingressos e atrações</p>
          <h2 className="mt-2 text-2xl font-black">Parques, passeios e experiências</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Cadastro próprio para ingressos. Aqui não existem origem, destino, voo, hotel ou noites.
          </p>
        </div>
        <button type="button" onClick={aberto ? () => setAberto(false) : novo} className="rounded-xl bg-fuchsia-600 px-5 py-3 font-black text-white hover:bg-fuchsia-700">
          {aberto ? "Fechar cadastro" : "+ Adicionar ingresso"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Cadastrados</p><p className="mt-2 text-3xl font-black">{ingressos.length}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Ativos</p><p className="mt-2 text-3xl font-black text-emerald-700">{ativos}</p></div>
        <div className="rounded-2xl bg-fuchsia-50 p-4"><p className="text-xs font-black uppercase text-fuchsia-700">Tipo</p><p className="mt-2 font-black">Ingresso / atração</p></div>
      </div>

      {aviso ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{aviso}</div> : null}
      {erro ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{erro}</div> : null}

      {aberto ? (
        <form onSubmit={salvar} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="xl:col-span-2"><span className="text-sm font-black">Título *</span><input required value={form.titulo} onChange={(e) => alterar("titulo", e.target.value)} placeholder="Ex.: Ingresso Beto Carrero World" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Parceiro *</span><select value={form.parceiro} onChange={(e) => alterar("parceiro", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option>Decolar</option></select></label>

            <label className="xl:col-span-3"><span className="text-sm font-black">Link original</span><input type="url" value={form.link_original} onChange={(e) => alterar("link_original", e.target.value)} placeholder="Link da página do ingresso no parceiro" className="mt-2 w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-3" /></label>
            <label className="xl:col-span-3"><span className="text-sm font-black">Link afiliado *</span><input required type="url" value={form.link_afiliado} onChange={(e) => alterar("link_afiliado", e.target.value)} placeholder="Link afiliado que será usado no botão público" className="mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3" /></label>

            <label className="xl:col-span-2"><span className="text-sm font-black">Atração *</span><input required value={form.atracao_nome} onChange={(e) => alterar("atracao_nome", e.target.value)} placeholder="Beto Carrero World" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Cidade / UF</span><input value={form.cidade_uf} onChange={(e) => alterar("cidade_uf", e.target.value)} placeholder="Penha / SC" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Data de uso</span><input type="date" value={form.data_uso} onChange={(e) => alterar("data_uso", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Adultos</span><input type="number" min="0" value={form.adultos} onChange={(e) => alterar("adultos", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Crianças</span><input type="number" min="0" value={form.criancas} onChange={(e) => alterar("criancas", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Preço total *</span><input required type="number" min="0.01" step="0.01" value={form.preco_total} onChange={(e) => alterar("preco_total", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Preço por pessoa</span><input type="number" min="0" step="0.01" value={form.preco_por_pessoa} onChange={(e) => alterar("preco_por_pessoa", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Validade da oferta</span><input type="date" value={form.validade} onChange={(e) => alterar("validade", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label><span className="text-sm font-black">Status</span><select value={form.status} onChange={(e) => alterar("status", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option value="rascunho">Rascunho</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
            <label className="xl:col-span-3"><span className="text-sm font-black">Imagem</span><input type="url" value={form.imagem_url} onChange={(e) => alterar("imagem_url", e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label className="xl:col-span-3"><span className="text-sm font-black">Observações</span><textarea rows={3} value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" /></label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={form.destaque} onChange={(e) => alterar("destaque", e.target.checked)} /><span className="text-sm font-black">Destacar ingresso</span></label>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            {editandoId ? <button type="button" onClick={novo} className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black">Cancelar edição</button> : null}
            <button disabled={salvando} type="submit" className="rounded-xl bg-slate-950 px-6 py-3 font-black text-white disabled:opacity-50">{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar ingresso"}</button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-black">Ingresso</th><th className="px-4 py-3 font-black">Local</th><th className="px-4 py-3 font-black">Preço</th><th className="px-4 py-3 font-black">Parceiro</th><th className="px-4 py-3 font-black">Status</th><th className="px-4 py-3 font-black">Ações</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Carregando ingressos...</td></tr> : ingressos.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum ingresso cadastrado ainda.</td></tr> : ingressos.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{item.titulo}<div className="text-xs text-slate-500">{item.atracao_nome}</div></td>
                <td className="px-4 py-3">{item.cidade_uf || "—"}{item.data_uso ? <div className="text-xs text-slate-500">Uso: {dataInput(item.data_uso)}</div> : null}</td>
                <td className="px-4 py-3 font-black">{moeda(item.preco_por_pessoa || item.preco_total, item.moeda)}{item.preco_por_pessoa ? <div className="text-xs font-medium text-slate-500">por pessoa</div> : null}</td>
                <td className="px-4 py-3"><a href={item.link_afiliado} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">{item.parceiro} ↗</a></td>
                <td className="px-4 py-3 font-bold">{item.status}{item.destaque ? <div className="text-xs text-amber-600">⭐ Destaque</div> : null}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => editar(item)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white">✏️ Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
