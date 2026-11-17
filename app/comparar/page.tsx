"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Produto = {
  id:number; nome:string; loja:string; categoria:string; imagem:string;
  preco_antigo:number|null; preco_atual:number|null; ativo:boolean|null;
  avaliacao:number|null; frete_gratis:boolean|null; parcelas:string|null;
  tem_em_casa:boolean|null; review_completa:boolean|null; nota_casal:number|null;
};

const KEY="achados_comparar";

function moeda(v:number|null|undefined){
  const n=Number(v);
  return Number.isFinite(n)?n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):"—";
}

export default function CompararPage(){
  const [produtos,setProdutos]=useState<Produto[]>([]);
  const [carregando,setCarregando]=useState(true);

  async function carregar(){
    let ids:number[]=[];
    try { ids=JSON.parse(localStorage.getItem(KEY)||"[]"); } catch {}
    ids=ids.map(Number).filter((id)=>Number.isInteger(id)&&id>0).slice(0,3);
    if(!ids.length){setProdutos([]);setCarregando(false);return;}
    const r=await fetch("/api/produtos/resumo?ids="+ids.join(","),{cache:"no-store"});
    const j=await r.json();
    setProdutos(j.produtos||[]);
    setCarregando(false);
  }

  useEffect(()=>{carregar();},[]);

  function remover(id:number){
    const novos=produtos.filter((p)=>p.id!==id);
    setProdutos(novos);
    localStorage.setItem(KEY,JSON.stringify(novos.map((p)=>p.id)));
    window.dispatchEvent(new CustomEvent("achados:lista-local"));
  }

  const linhas = [
    ["Preço",(p:Produto)=>p.ativo?moeda(p.preco_atual):"Sem oferta ativa"],
    ["Categoria",(p:Produto)=>p.categoria||"—"],
    ["Nota da loja",(p:Produto)=>p.avaliacao?"⭐ "+p.avaliacao:"—"],
    ["Nota do casal",(p:Produto)=>p.nota_casal?"⭐ "+Number(p.nota_casal).toLocaleString("pt-BR",{maximumFractionDigits:1})+"/10":"—"],
    ["Temos em casa",(p:Produto)=>p.tem_em_casa?"Sim":"Não"],
    ["Review do casal",(p:Produto)=>p.review_completa?"Sim":"Não"],
    ["Frete grátis",(p:Produto)=>p.frete_gratis?"Sim":"—"],
    ["Parcelamento",(p:Produto)=>p.parcelas||"—"],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="bg-blue-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <Link href="/" className="text-sm font-black text-white/80">← Voltar</Link>
          <h1 className="mt-5 text-4xl font-black">⚖️ Comparar produtos</h1>
          <p className="mt-3 text-blue-100">Compare até 3 produtos lado a lado.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl overflow-x-auto px-5 py-12">
        {carregando ? (
          <p>Carregando...</p>
        ) : produtos.length < 2 ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            <h2 className="text-2xl font-black">Selecione pelo menos 2 produtos</h2>
            <p className="mt-2 text-slate-500">Use o botão ⚖️ nos produtos para montar a comparação.</p>
            <Link href="/" className="mt-5 inline-flex rounded-xl bg-blue-950 px-5 py-3 font-black text-white">Escolher produtos</Link>
          </div>
        ) : (
          <div className="min-w-[760px] overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="grid" style={{gridTemplateColumns:"180px repeat("+produtos.length+", minmax(190px, 1fr))"}}>
              <div className="bg-slate-50 p-4 font-black">Produto</div>
              {produtos.map((p)=>(
                <div key={p.id} className="border-l border-slate-200 p-4">
                  <img src={p.imagem} alt={p.nome} className="mx-auto h-28 w-full object-contain"/>
                  <p className="mt-3 text-xs font-black uppercase text-blue-800">{p.loja}</p>
                  <p className="mt-1 font-black">{p.nome}</p>
                  <button onClick={()=>remover(p.id)} className="mt-2 text-xs font-bold text-red-600">Remover</button>
                </div>
              ))}
              {linhas.map(([rotulo,fn])=>(
                <div key={rotulo} className="contents">
                  <div className="border-t border-slate-200 bg-slate-50 p-4 font-black">{rotulo}</div>
                  {produtos.map((p)=>(
                    <div key={p.id} className="border-l border-t border-slate-200 p-4 font-bold text-slate-700">{fn(p)}</div>
                  ))}
                </div>
              ))}
              <div className="border-t border-slate-200 bg-slate-50 p-4 font-black">Ação</div>
              {produtos.map((p)=>(
                <div key={p.id} className="border-l border-t border-slate-200 p-4">
                  <Link href={"/produto/"+p.id} className="inline-flex w-full justify-center rounded-xl bg-blue-950 px-4 py-3 font-black text-white">Ver produto</Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
