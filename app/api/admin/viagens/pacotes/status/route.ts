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

  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,tipo,titulo,status,parceiro,origem_codigo,destino_codigo,destino_nome,
      local_nome,cidade_uf,data_ida,data_volta,hotel_nome,
      disponibilidade_status,disponibilidade_falhas,disponibilidade_verificada_em,
      disponibilidade_motivo,disponibilidade_ultima_ok_em,arquivado_em,created_at
    `)
    .is("arquivado_em", null)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("[Saude viagens] Falha ao listar ofertas:", error);
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  const ofertas = (data ?? []).map((item: any) => ({
    ...item,
    origem_tabela: "viagens_pacotes",
    chave: `viagens_pacotes:${item.id}`,
    tipo: item.tipo || "pacote",
    local_resumo:
      item.tipo === "pacote"
        ? [item.origem_codigo, item.destino_codigo].filter(Boolean).join(" → ")
        : item.cidade_uf || item.local_nome || item.destino_nome || item.hotel_nome || "—",
  }));

  return NextResponse.json(
    { sucesso: true, ofertas, pacotes: ofertas },
    { headers: { "Cache-Control": "no-store" } }
  );
}
