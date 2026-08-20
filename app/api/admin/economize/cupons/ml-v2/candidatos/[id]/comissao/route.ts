import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = {
  params: Promise<{
    id: string;
  }>;
};

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

function normalizarPercentual(valor: unknown) {
  if (typeof valor === "string") {
    valor = valor.trim().replace(",", ".");
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    return null;
  }

  return Math.round(numero * 100) / 100;
}

function primeiroItemId(dadosBrutos: Record<string, unknown>) {
  const itemIds = Array.isArray(dadosBrutos.item_ids) ? dadosBrutos.item_ids : [];
  const primeiro = String(itemIds[0] || "").trim().toUpperCase();
  return /^MLB\d+$/.test(primeiro) ? primeiro : null;
}

export async function PATCH(request: Request, contexto: ContextoRota) {
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

  const { id } = await contexto.params;
  const body = (await request.json().catch(() => null)) as
    | { percentual?: number | string; item_id?: string | null }
    | null;

  const percentual = normalizarPercentual(body?.percentual);

  if (percentual === null) {
    return NextResponse.json(
      { sucesso: false, erro: "Informe uma comissao entre 0% e 100%." },
      { status: 400 }
    );
  }

  const { data: candidato, error: erroBusca } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select("id,origem,status,dados_brutos")
    .eq("id", id)
    .single();

  if (erroBusca || !candidato) {
    return NextResponse.json(
      { sucesso: false, erro: "Candidato nao encontrado." },
      { status: 404 }
    );
  }

  if (candidato.origem !== "mercado_livre_v2") {
    return NextResponse.json(
      { sucesso: false, erro: "Este candidato nao pertence ao ML V2." },
      { status: 400 }
    );
  }

  const bruto = (candidato.dados_brutos || {}) as Record<string, unknown>;
  const itemInformado = String(body?.item_id || "").trim().toUpperCase();
  const itemId = /^MLB\d+$/.test(itemInformado)
    ? itemInformado
    : primeiroItemId(bruto);
  const agora = new Date().toISOString();

  const dadosBrutos = {
    ...bruto,
    comissao_afiliado: {
      item_id: itemId,
      percentual,
      status: "verificada_manual",
      erro: null,
      url_final: null,
      verificada_em: agora,
      fonte: "manual_admin",
      observacao: "percentual informado manualmente no admin ML V2",
    },
  };

  const { data: atualizado, error: erroUpdate } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .update({
      dados_brutos: dadosBrutos,
      updated_at: agora,
    })
    .eq("id", id)
    .select("id,status,dados_brutos")
    .single();

  if (erroUpdate || !atualizado) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: erroUpdate?.message || "Falha salvando comissao manual.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    candidato_id: atualizado.id,
    status: atualizado.status,
    percentual,
    item_id: itemId,
    verificada_em: agora,
  });
}
