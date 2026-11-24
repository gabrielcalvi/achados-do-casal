import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { usuarioAdminAutenticado } from "@/lib/local-agent/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await usuarioAdminAutenticado())) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("local_agent_jobs")
    .select("id,task_type,status,payload,error,attempts,created_at,started_at,finished_at,claimed_by")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, tarefas: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await usuarioAdminAutenticado();
  if (!user) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const taskType = body?.task_type;
  if (!["product_extract", "coupon_collect"].includes(taskType)) {
    return NextResponse.json({ sucesso: false, erro: "Tipo de tarefa invalido." }, { status: 400 });
  }
  const productUrl = String(body?.url || "").trim();
  const payload: Record<string, string> = taskType === "product_extract"
    ? { url: productUrl }
    : {};
  if (taskType === "product_extract") {
    try {
      if (!productUrl) throw new Error();
      const parsed = new URL(productUrl);
      if (!/mercadolivre|mercadolibre|meli\.la/i.test(parsed.hostname)) throw new Error();
    } catch {
      return NextResponse.json({ sucesso: false, erro: "Informe um link valido do Mercado Livre." }, { status: 400 });
    }
  }
  const { data, error } = await supabaseAdmin
    .from("local_agent_jobs")
    .insert({ task_type: taskType, payload, created_by: user.id })
    .select("id,task_type,status,created_at")
    .single();
  if (error || !data) return NextResponse.json({ sucesso: false, erro: error?.message || "Nao foi possivel criar a tarefa." }, { status: 500 });
  return NextResponse.json({ sucesso: true, tarefa: data });
}
