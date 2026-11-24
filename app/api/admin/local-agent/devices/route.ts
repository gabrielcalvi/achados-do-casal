import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashLocalAgentToken, usuarioAdminAutenticado } from "@/lib/local-agent/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await usuarioAdminAutenticado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("local_agent_devices")
    .select("id,name,created_at,last_seen_at,revoked_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, dispositivos: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await usuarioAdminAutenticado();
  if (!user) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "Computador local").trim().slice(0, 80);
  if (!name) return NextResponse.json({ sucesso: false, erro: "Informe o nome do computador." }, { status: 400 });

  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabaseAdmin
    .from("local_agent_devices")
    .insert({ name, token_hash: hashLocalAgentToken(token) })
    .select("id,name,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ sucesso: false, erro: error?.message || "Falha ao parear dispositivo." }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    dispositivo: data,
    token,
    aviso: "Copie o token agora. Ele nao sera exibido novamente e deve ficar somente no .env.local do computador.",
  });
}
