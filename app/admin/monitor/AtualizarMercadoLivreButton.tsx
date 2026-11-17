"use client";

import { useState } from "react";

export default function AtualizarMercadoLivreButton() {
  const [estado,setEstado]=useState<"idle"|"rodando"|"ok"|"erro">("idle");
  const [resumo,setResumo]=useState("");

  async function executar(){
    setEstado("rodando");
    setResumo("");
    const r=await fetch("/api/admin/monitor/ml-manual",{method:"POST"});
    const j=await r.json();
    if(!r.ok || !j.sucesso){
      setEstado("erro");
      setResumo(j.erro||"Falha ao verificar Mercado Livre.");
      return;
    }
    const x=j.resultado;
    setEstado("ok");
    setResumo(`${x.total} verificados · ${x.atualizados} atualizados · ${x.erros} com falha`);
    window.setTimeout(()=>window.location.reload(),1800);
  }

  return <div className="flex flex-col items-end gap-2">
    <button
      type="button"
      onClick={executar}
      disabled={estado==="rodando"}
      className="rounded-xl bg-yellow-400 px-4 py-3 font-black text-slate-950 transition hover:bg-yellow-300 disabled:opacity-60"
    >
      {estado==="rodando"?"Verificando ML...":"🟡 Atualizar preços Mercado Livre"}
    </button>
    {resumo?<p className={`text-xs font-bold ${estado==="erro"?"text-red-600":"text-slate-500"}`}>{resumo}</p>:null}
  </div>;
}
