import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { autenticarAgenteLocal } from "@/lib/local-agent/auth";
import { persistirCandidatosMlV2 } from "@/lib/services/mlV2Candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const device = await autenticarAgenteLocal(request);
  if (!device) return NextResponse.json({ sucesso: false, erro: "Dispositivo nao autorizado ou revogado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  const ok = body?.sucesso === true;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ sucesso: false, erro: "ID de tarefa invalido." }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from("local_agent_jobs")
    .select("id,task_type,status,claimed_by")
    .eq("id", id)
    .maybeSingle();

  if (jobError || !job) return NextResponse.json({ sucesso: false, erro: "Tarefa nao encontrada." }, { status: 404 });
  if (job.claimed_by !== device.id || job.status !== "running") {
    return NextResponse.json({ sucesso: false, erro: "A tarefa nao pertence a este dispositivo ou nao esta em execucao." }, { status: 409 });
  }

  let result = body?.result ?? null;
  if (job.task_type === "coupon_collect" && ok) {
    const coupons = Array.isArray(result?.cupons) ? result.cupons : [];
    const states = await persistirCandidatosMlV2(coupons);
    result = {
      total_paginas_lidas: result?.total_paginas_lidas ?? 0,
      total_encontrados: coupons.length,
      varredura_completa: Boolean(result?.varredura_completa),
      amostra: coupons.slice(0, 12).map((coupon: Record<string, any>) => ({
        campanha_id: coupon.campanha_id,
        titulo: coupon.titulo,
        valor_desconto: coupon.valor_desconto,
        status: states.get(String(coupon.campanha_id || ""))?.status ?? "coletado",
      })),
    };
  }

  const { error } = await supabaseAdmin
    .from("local_agent_jobs")
    .update({
      status: ok ? "completed" : "failed",
      result: ok ? result : null,
      error: ok ? null : String(body?.error || "Falha no agente local.").slice(0, 2000),
      finished_at: new Date().toISOString(),
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("claimed_by", device.id);

  if (error) return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, status: ok ? "completed" : "failed" });
}
