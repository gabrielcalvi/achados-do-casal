import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,
      titulo,
      status,
      parceiro,
      origem_codigo,
      destino_codigo,
      data_ida,
      data_volta,
      disponibilidade_status,
      disponibilidade_falhas,
      disponibilidade_verificada_em,
      disponibilidade_motivo,
      disponibilidade_ultima_ok_em
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[Pacotes disponibilidade] Falha ao listar status:", error);
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { sucesso: true, pacotes: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
