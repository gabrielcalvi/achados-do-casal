import { supabaseAdmin } from "@/lib/supabase/admin";
import ComunidadeReviewForm from "./ComunidadeReviewForm";

export const dynamic = "force-dynamic";

export default async function ComunidadeAdminPage(){
  const [{data:pedidos},{data:alertas},{data:produtos},{data:atualizacoes}] = await Promise.all([
    supabaseAdmin.from("produto_solicitacoes_review").select("id,produto_id,url_produto,nome_produto,mensagem,status,criado_em").order("criado_em",{ascending:false}).limit(50),
    supabaseAdmin.from("produto_alertas_preco").select("id,produto_id,email,preco_referencia,preco_alvo,ultimo_preco,status,atingido_em,criado_em").order("criado_em",{ascending:false}).limit(50),
    supabaseAdmin.from("produtos").select("id,nome,loja").eq("review_completa",true).order("id",{ascending:false}),
    supabaseAdmin.from("review_atualizacoes").select("id,produto_id,titulo,nota,data_referencia,tempo_de_uso").order("data_referencia",{ascending:false}).limit(30),
  ]);

  const nomes = new Map((produtos||[]).map((p)=>[Number(p.id),p.nome]));

  return <main className="mx-auto max-w-7xl px-5 py-10">
    <h1 className="text-3xl font-black">Comunidade</h1>
    <p className="mt-2 text-slate-500">Pedidos de review, alertas de preço e evolução das avaliações.</p>

    <div className="mt-8">
      <ComunidadeReviewForm produtos={(produtos||[]) as any[]} />
    </div>

    <section className="mt-10">
      <h2 className="text-2xl font-black">🙋 Pedidos de review</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[850px] w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="p-3">Produto</th><th className="p-3">Mensagem</th><th className="p-3">Status</th><th className="p-3">Data</th></tr>
          </thead>
          <tbody>
            {(pedidos||[]).map((p:any)=><tr key={p.id} className="border-t border-slate-100">
              <td className="p-3 font-bold">{p.produto_id ? (nomes.get(Number(p.produto_id)) || ("Produto #"+p.produto_id)) : (p.nome_produto || p.url_produto || "—")}</td>
              <td className="p-3 text-slate-600">{p.mensagem || "—"}</td>
              <td className="p-3 font-bold">{p.status}</td>
              <td className="p-3">{new Date(p.criado_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section className="mt-10">
      <h2 className="text-2xl font-black">🔔 Alertas de preço</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr><th className="p-3">Produto</th><th className="p-3">E-mail</th><th className="p-3">Referência</th><th className="p-3">Meta</th><th className="p-3">Último</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {(alertas||[]).map((a:any)=><tr key={a.id} className="border-t border-slate-100">
              <td className="p-3 font-bold">{nomes.get(Number(a.produto_id)) || ("Produto #"+a.produto_id)}</td>
              <td className="p-3">{a.email}</td>
              <td className="p-3">R$ {Number(a.preco_referencia).toFixed(2).replace(".",",")}</td>
              <td className="p-3">{a.preco_alvo ? "R$ "+Number(a.preco_alvo).toFixed(2).replace(".",",") : "Qualquer queda"}</td>
              <td className="p-3">{a.ultimo_preco ? "R$ "+Number(a.ultimo_preco).toFixed(2).replace(".",",") : "—"}</td>
              <td className="p-3 font-black">{a.status}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    <section className="mt-10">
      <h2 className="text-2xl font-black">📈 Histórico recente de reviews</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(atualizacoes||[]).map((u:any)=><div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase text-blue-800">{nomes.get(Number(u.produto_id)) || ("Produto #"+u.produto_id)}</p>
          <p className="mt-1 font-black">{u.titulo}</p>
          <p className="mt-2 text-sm text-slate-500">{new Date(u.data_referencia+"T12:00:00Z").toLocaleDateString("pt-BR")} {u.nota ? "· ⭐ "+u.nota+"/10" : ""}</p>
        </div>)}
      </div>
    </section>
  </main>;
}
