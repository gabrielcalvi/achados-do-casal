import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function normalizarIds(valor: unknown) {
  if (!Array.isArray(valor)) return [];

  return [
    ...new Set(
      valor
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, MAX_IDS)
    ),
  ];
}

export async function PATCH(request: Request) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin) {
    return NextResponse.json(
      { sucesso: false, erro: "Origem da acao invalida." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { ids?: unknown; acao?: string }
    | null;
  const acao = String(body?.acao || "descartar").trim().toLowerCase();
  const ids = normalizarIds(body?.ids);

  if (acao !== "descartar") {
    return NextResponse.json(
      { sucesso: false, erro: "Acao em lote invalida." },
      { status: 400 }
    );
  }

  if (ids.length === 0) {
    return NextResponse.json(
      { sucesso: false, erro: "Selecione ao menos um candidato." },
      { status: 400 }
    );
  }

  const { data: candidatos, error: erroBusca } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select("id,status,origem")
    .in("id", ids)
    .eq("origem", "mercado_livre_v2");

  if (erroBusca) {
    return NextResponse.json(
      { sucesso: false, erro: erroBusca.message },
      { status: 500 }
    );
  }

  const idsValidos = (candidatos || [])
    .filter((item) => item.status !== "publicado" && item.status !== "descartado")
    .map((item) => item.id);

  if (idsValidos.length === 0) {
    return NextResponse.json({
      sucesso: true,
      descartados: 0,
      ignorados: ids.length,
      mensagem: "Nenhum dos selecionados podia ser descartado.",
    });
  }

  const agora = new Date().toISOString();
  const { data: atualizados, error: erroUpdate } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .update({
      status: "descartado",
      aprovado_em: null,
      analisado_em: agora,
      updated_at: agora,
    })
    .in("id", idsValidos)
    .select("id");

  if (erroUpdate) {
    return NextResponse.json(
      { sucesso: false, erro: erroUpdate.message },
      { status: 500 }
    );
  }

  const descartados = atualizados?.length || 0;

  return NextResponse.json({
    sucesso: true,
    descartados,
    ignorados: Math.max(0, ids.length - descartados),
    mensagem:
      descartados === 1
        ? "1 candidato descartado."
        : `${descartados} candidatos descartados.`,
  });
}
