"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Produto = {
  id:number; nome:string; loja:string; categoria:string; imagem:string;
  preco_antigo:number|null; preco_atual:number|null; ativo:boolean|null;
  review_completa:boolean|null;
};

const KEY = "achados_favoritos";

function moeda(v:number|null|undefined){
  const n=Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "—";
}

export default function FavoritosPage(){
  const [produtos,setProdutos]=useState<Produto[]>([]);
  const [carregando,setCarregando]=useState(true);

  async function carregar(){
    let ids:number[]=[];
    try { ids=JSON.parse(localStorage.getItem(KEY)||"[]"); } catch {}
    ids=ids.map(Number).filter((id)=>Number.isInteger(id)&&id>0);
    if(!ids.length){ setProdutos([]); setCarregando(false); return; }
    const r=await fetch("/api/produtos/resumo?ids="+ids.join(","),{cache:"no-store"});
    const j=await r.json();
    setProdutos(j.produtos||[]);
    setCarregando(false);
  }

  useEffect(()=>{ carregar(); },[]);

  function remover(id:number){
    const ids=produtos.filter((p)=>p.id!==id).map((p)=>p.id);
    localStorage.setItem(KEY,JSON.stringify(ids));
    setProdutos((atuais)=>atuais.filter((p)=>p.id!==id));
    window.dispatchEvent(new CustomEvent("achados:lista-local"));
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="bg-gradient-to-br from-pink-500 to-rose-400 text-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <Link href="/" className="text-sm font-black text-white/90">← Voltar</Link>
          <h1 className="mt-5 text-4xl font-black">❤️ Meus favoritos</h1>
          <p className="mt-3 max-w-2xl text-white/90">Salvos neste dispositivo, sem precisar criar conta.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12">
        {carregando ? (
          <p className="font-bold text-slate-500">Carregando favoritos...</p>
        ) : produtos.length===0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-2xl font-black">Nenhum favorito ainda</h2>
            <p className="mt-2 text-slate-500">Use o coração nos produtos que quiser guardar.</p>
            <Link href="/" className="mt-5 inline-flex rounded-xl bg-blue-950 px-5 py-3 font-black text-white">Ver ofertas</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p)=>(
              <article key={p.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <Link href={"/produto/"+p.id} className="flex h-52 items-center justify-center rounded-2xl bg-slate-50 p-4">
                  <img src={p.imagem} alt={p.nome} className="max-h-44 w-full object-contain"/>
                </Link>
                <p className="mt-4 text-xs font-black uppercase text-blue-800">{p.loja}</p>
                <h2 className="mt-2 line-clamp-2 text-xl font-black">{p.nome}</h2>
                {p.review_completa ? <span className="mt-3 w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">⭐ Review do casal</span>:null}
                <p className="mt-4 text-2xl font-black text-pink-600">{p.ativo?moeda(p.preco_atual):"Oferta não ativa"}</p>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                  <Link href={"/produto/"+p.id} className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-950 px-3 text-sm font-black text-white">Ver produto</Link>
                  <button onClick={()=>remover(p.id)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-600">Remover</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
