import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function autorizado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ sucesso: false, erro: "Etapa invalida." }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body || {}, "concluido")) payload.concluido = Boolean(body.concluido);
    if (Object.prototype.hasOwnProperty.call(body || {}, "observacoes")) {
      payload.observacoes = typeof body.observacoes === "string" && body.observacoes.trim() ? body.observacoes.trim() : null;
    }

    const { data, error } = await supabaseAdmin
      .from("afiliados_checklist")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, etapa: data });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro ao atualizar checklist.",
    }, { status: 500 });
  }
}
