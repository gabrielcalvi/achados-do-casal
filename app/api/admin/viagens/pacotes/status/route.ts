import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const [ofertasResp, ingressosResp] = await Promise.all([
    supabaseAdmin
      .from("viagens_pacotes")
      .select(`
        id,tipo,titulo,status,parceiro,origem_codigo,destino_codigo,destino_nome,
        local_nome,cidade_uf,data_ida,data_volta,hotel_nome,
        disponibilidade_status,disponibilidade_falhas,disponibilidade_verificada_em,
        disponibilidade_motivo,disponibilidade_ultima_ok_em,created_at
      `)
      .order("created_at", { ascending: false })
      .limit(150),
    supabaseAdmin
      .from("viagens_ingressos")
      .select(`
        id,titulo,status,parceiro,atracao_nome,cidade_uf,data_uso,
        disponibilidade_status,disponibilidade_falhas,disponibilidade_verificada_em,
        disponibilidade_motivo,disponibilidade_ultima_ok_em,created_at
      `)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (ofertasResp.error) {
    console.error("[Saude viagens] Falha ao listar ofertas:", ofertasResp.error);
    return NextResponse.json({ sucesso: false, erro: ofertasResp.error.message }, { status: 500 });
  }
  if (ingressosResp.error) {
    console.error("[Saude viagens] Falha ao listar ingressos:", ingressosResp.error);
    return NextResponse.json({ sucesso: false, erro: ingressosResp.error.message }, { status: 500 });
  }

  const ofertas = [
    ...(ofertasResp.data ?? []).map((item: any) => ({
      ...item,
      origem_tabela: "viagens_pacotes",
      chave: `viagens_pacotes:${item.id}`,
      tipo: item.tipo || "pacote",
      local_resumo:
        item.tipo === "pacote"
          ? [item.origem_codigo, item.destino_codigo].filter(Boolean).join(" → ")
          : item.cidade_uf || item.local_nome || item.destino_nome || item.hotel_nome || "—",
    })),
    ...(ingressosResp.data ?? []).map((item: any) => ({
      ...item,
      origem_tabela: "viagens_ingressos",
      chave: `viagens_ingressos:${item.id}`,
      tipo: "ingresso",
      local_resumo: item.cidade_uf || item.atracao_nome || "—",
      origem_codigo: null,
      destino_codigo: null,
      data_ida: item.data_uso,
      data_volta: null,
    })),
  ].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json(
    { sucesso: true, ofertas, pacotes: ofertas },
    { headers: { "Cache-Control": "no-store" } }
  );
}
