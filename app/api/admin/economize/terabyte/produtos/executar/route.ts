import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sincronizarCatalogoTerabyte } from "@/lib/terabyte/catalogSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cronAutorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}
async function usuarioAutorizado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch { return false; }
}
async function executar(request: NextRequest) {
  if (!cronAutorizado(request) && !(await usuarioAutorizado())) return NextResponse.json({ sucesso:false, erro:"Nao autorizado." },{status:401});
  try {
    const resultado=await sincronizarCatalogoTerabyte();
    return NextResponse.json(resultado,{headers:{"Cache-Control":"no-store"}});
  } catch(erro) {
    console.error("[TeraByte] Falha na sincronizacao do catalogo:",erro);
    return NextResponse.json({sucesso:false,erro:erro instanceof Error?erro.message:String(erro)},{status:500});
  }
}
export async function GET(request:NextRequest){return executar(request);}
export async function POST(request:NextRequest){return executar(request);}
