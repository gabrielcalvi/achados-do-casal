import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { autenticarAgenteLocal } from "@/lib/local-agent/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const device = await autenticarAgenteLocal(request);
  if (!device) return NextResponse.json({ sucesso: false, erro: "Dispositivo nao autorizado ou revogado." }, { status: 401 });

  const { data, error } = await supabaseAdmin.rpc("claim_local_agent_job", { p_device_id: device.id });
  if (error) return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, dispositivo: device.name, tarefa: Array.isArray(data) ? data[0] || null : data || null });
}
