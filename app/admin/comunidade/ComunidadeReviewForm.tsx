"use client";

import { useState } from "react";

type Produto = { id:number; nome:string; loja:string };

export default function ComunidadeReviewForm({ produtos }: { produtos: Produto[] }) {
  const [produtoId,setProdutoId]=useState(produtos[0]?.id?.toString()||"");
  const [titulo,setTitulo]=useState("");
  const [texto,setTexto]=useState("");
  const [nota,setNota]=useState("");
  const [tempo,setTempo]=useState("");
  const [data,setData]=useState(new Date().toISOString().slice(0,10));
  const [estado,setEstado]=useState<"idle"|"salvando"|"ok"|"erro">("idle");

  async function salvar(e:React.FormEvent){
    e.preventDefault(); setEstado("salvando");
    const r=await fetch("/api/admin/comunidade/review-atualizacao",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({produtoId:Number(produtoId),titulo,texto,nota,tempoDeUso:tempo,dataReferencia:data})
    });
    if(!r.ok){setEstado("erro");return;}
    setTitulo("");setTexto("");setNota("");setTempo("");setEstado("ok");
  }

  return <form onSubmit={salvar} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-black">📈 Nova atualização de review</h2>
    <p className="mt-1 text-sm text-slate-500">Registre como a experiência mudou com o tempo.</p>
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <select value={produtoId} onChange={e=>setProdutoId(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3">
        {produtos.map(p=><option key={p.id} value={p.id}>{p.nome} · {p.loja}</option>)}
      </select>
      <input type="date" value={data} onChange={e=>setData(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3"/>
      <input value={titulo} onChange={e=>setTitulo(e.target.value)} required maxLength={160} placeholder="Ex.: 6 meses de uso" className="h-11 rounded-xl border border-slate-300 px-3"/>
      <input value={tempo} onChange={e=>setTempo(e.target.value)} maxLength={120} placeholder="Tempo de uso (opcional)" className="h-11 rounded-xl border border-slate-300 px-3"/>
      <input value={nota} onChange={e=>setNota(e.target.value)} inputMode="decimal" placeholder="Nota atual (0 a 10)" className="h-11 rounded-xl border border-slate-300 px-3"/>
      <div />
      <textarea value={texto} onChange={e=>setTexto(e.target.value)} required rows={4} placeholder="O que mudou na opinião?" className="md:col-span-2 rounded-xl border border-slate-300 p-3"/>
    </div>
    <button disabled={estado==="salvando"} className="mt-4 rounded-xl bg-blue-950 px-5 py-3 font-black text-white">
      {estado==="salvando"?"Salvando...":"Salvar atualização"}
    </button>
    {estado==="ok"?<p className="mt-2 text-sm font-bold text-emerald-700">✅ Atualização salva.</p>:null}
    {estado==="erro"?<p className="mt-2 text-sm font-bold text-red-700">Erro ao salvar.</p>:null}
  </form>;
}
