import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterStatusIntegracaoCj } from "@/lib/afiliados/cj";

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

  const status = obterStatusIntegracaoCj();

  return NextResponse.json({
    sucesso: true,
    rede: "CJ Affiliate",
    status,
    observacao: status.prontaParaAutenticar
      ? "Credenciais basicas presentes."
      : "A camada CJ ja esta preparada; falta configurar credenciais e endpoints liberados pela conta.",
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
