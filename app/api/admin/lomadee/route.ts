import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  diagnosticarLomadee,
  lomadeeConfigurada,
  salvarChaveLomadee,
  testarChaveLomadee,
} from "@/lib/lomadee/api";

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

export async function GET(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const configurada = await lomadeeConfigurada();
  const diagnosticoSolicitado =
    request.nextUrl.searchParams.get("diagnostico") === "1";

  if (!diagnosticoSolicitado || !configurada) {
    return NextResponse.json(
      { sucesso: true, configurada },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const diagnostico = await diagnosticarLomadee();
    return NextResponse.json(
      {
        sucesso: true,
        configurada: true,
        apiRespondendo: true,
        ...diagnostico,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: true,
        configurada: true,
        apiRespondendo: false,
        diagnosticoErro:
          erro instanceof Error ? erro.message : "Falha ao testar a API.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await autorizado())) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const chave = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!chave) return NextResponse.json({ sucesso: false, erro: "Informe a API Key da Lomadee." }, { status: 400 });

    const teste = await testarChaveLomadee(chave);
    await salvarChaveLomadee(chave);

    return NextResponse.json({ sucesso: true, configurada: true, totalMarcas: teste.totalMarcas });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : "Falha ao conectar a Lomadee." }, { status: 400 });
  }
}
