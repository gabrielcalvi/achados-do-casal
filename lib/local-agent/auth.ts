import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function hashLocalAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function autenticarAgenteLocal(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length < 32) return null;

  const hash = hashLocalAgentToken(token);
  const { data, error } = await supabaseAdmin
    .from("local_agent_devices")
    .select("id,name,revoked_at,token_hash")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const esperado = Buffer.from(data.token_hash, "hex");
  const recebido = Buffer.from(hash, "hex");
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    return null;
  }

  await supabaseAdmin
    .from("local_agent_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return { id: data.id as string, name: data.name as string };
}

export async function usuarioAdminAutenticado() {
  const { createClient } = await import("@/lib/supabase/server");
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && user ? user : null;
  } catch {
    return null;
  }
}
