import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function primeiroItemId(dadosBrutos: unknown) {
  const bruto = (dadosBrutos || {}) as Record<string, unknown>;
  const itemIds = Array.isArray(bruto.item_ids) ? bruto.item_ids : [];
  const primeiro = String(itemIds[0] || "").trim().toUpperCase();
  return /^MLB\d+$/.test(primeiro) ? primeiro : null;
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select("id,status,dados_brutos,ultima_coleta_em")
    .eq("origem", "mercado_livre_v2")
    .neq("status", "descartado")
    .order("ultima_coleta_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }

  const candidatos = (data || []).filter((item) => primeiroItemId(item.dados_brutos));
  let processados = 0;
  let comComissao = 0;
  let comissaoZero = 0;
  let naoIdentificados = 0;
  let erros = 0;
  let ultimoItem: string | null = null;
  let atualizadoEm: string | null = null;

  for (const candidato of candidatos) {
    const bruto = (candidato.dados_brutos || {}) as Record<string, any>;
    const comissao =
      bruto.comissao_afiliado && typeof bruto.comissao_afiliado === "object"
        ? bruto.comissao_afiliado
        : null;

    if (!comissao?.verificada_em) continue;

    processados += 1;
    const percentual = Number(comissao.percentual);
    const status = String(comissao.status || "");

    if (Number.isFinite(percentual) && percentual > 0) {
      comComissao += 1;
    } else if (Number.isFinite(percentual) && percentual === 0) {
      comissaoZero += 1;
    } else if (status === "erro") {
      erros += 1;
    } else {
      naoIdentificados += 1;
    }

    const itemId = String(comissao.item_id || "").trim();
    const verificadaEm = String(comissao.verificada_em || "").trim();

    if (!atualizadoEm || verificadaEm > atualizadoEm) {
      atualizadoEm = verificadaEm;
      ultimoItem = itemId || null;
    }
  }

  return NextResponse.json({
    sucesso: true,
    disponivel: true,
    status:
      candidatos.length > 0 && processados >= candidatos.length
        ? "concluido"
        : "verificando",
    total: candidatos.length,
    processados,
    com_comissao: comComissao,
    comissao_zero: comissaoZero,
    nao_identificados: naoIdentificados,
    erros,
    ultimo_item: ultimoItem,
    atualizado_em: atualizadoEm,
  });
}
