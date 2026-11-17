import { supabaseAdmin } from "@/lib/supabase/admin";

export async function avaliarAlertasDePreco() {
  const { data: alertas, error } = await supabaseAdmin
    .from("produto_alertas_preco")
    .select("id,produto_id,preco_referencia,preco_alvo,status")
    .eq("status","ativo");

  if (error || !alertas?.length) {
    return { total: alertas?.length || 0, atingidos: 0, erro: error?.message || null };
  }

  const ids = Array.from(new Set(alertas.map((a)=>Number(a.produto_id)).filter(Boolean)));
  const { data: produtos, error: erroProdutos } = await supabaseAdmin
    .from("produtos")
    .select("id,preco_atual,ativo")
    .in("id",ids);

  if (erroProdutos) {
    return { total: alertas.length, atingidos: 0, erro: erroProdutos.message };
  }

  const porId = new Map((produtos||[]).map((p)=>[Number(p.id),p]));
  let atingidos=0;

  for (const alerta of alertas) {
    const produto=porId.get(Number(alerta.produto_id));
    const preco=Number(produto?.preco_atual);
    if (!produto?.ativo || !Number.isFinite(preco) || preco<=0) continue;

    const alvo=alerta.preco_alvo==null ? null : Number(alerta.preco_alvo);
    const referencia=Number(alerta.preco_referencia);
    const atingiu = alvo && Number.isFinite(alvo)
      ? preco <= alvo
      : Number.isFinite(referencia) && preco < referencia;

    const dados:any = { ultimo_preco: preco, atualizado_em:new Date().toISOString() };
    if (atingiu) {
      dados.status="atingido";
      dados.atingido_em=new Date().toISOString();
      atingidos++;
    }
    await supabaseAdmin.from("produto_alertas_preco").update(dados).eq("id",alerta.id);
  }

  return { total:alertas.length, atingidos, erro:null };
}
