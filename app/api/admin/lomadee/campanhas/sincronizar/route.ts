import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sincronizarCampanhasLomadee } from "@/lib/lomadee/campaignSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TEMP_SYNC_NONCE_HASH = "618d770bbdac017d79176b97593211edb5ee31554880b05a85972e7635fd5452";

function cronAutorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

function nonceTemporarioAutorizado(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get("sync_nonce") || "";
  if (!nonce) return false;
  const hash = createHash("sha256").update(nonce).digest("hex");
  return hash === TEMP_SYNC_NONCE_HASH;
}

async function usuarioAutorizado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function executar(request: NextRequest) {
  if (!cronAutorizado(request) && !nonceTemporarioAutorizado(request) && !(await usuarioAutorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await sincronizarCampanhasLomadee(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Falha ao sincronizar campanhas Lomadee.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
