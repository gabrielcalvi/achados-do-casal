import { NextResponse } from "next/server";
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

function urlProdutoMl(itemId: string) {
  const normalizado = String(itemId || "").trim().toUpperCase();
  const match = normalizado.match(/^MLB(\d+)$/);

  if (!match) return null;

  return `https://produto.mercadolivre.com.br/MLB-${match[1]}`;
}

function percentualComissao(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export async function GET() {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Não autorizado." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select(
      "id,campanha_externa_id,titulo,valor_desconto,validade,status,dados_brutos,top_produtos,ultima_coleta_em"
    )
    .eq("origem", "mercado_livre_v2")
    .order("ultima_coleta_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }

  const candidatos = (data || []).map((item) => {
    const bruto = (item.dados_brutos || {}) as Record<string, any>;
    const itemIds = Array.isArray(bruto.item_ids)
      ? bruto.item_ids.map((valor: unknown) => String(valor || "").trim()).filter(Boolean)
      : [];
    const produtos = Array.isArray(item.top_produtos) ? item.top_produtos : [];
    const comissao =
      bruto.comissao_afiliado && typeof bruto.comissao_afiliado === "object"
        ? bruto.comissao_afiliado
        : null;

    return {
      candidato_id: item.id,
      status: item.status,
      campanha_id: item.campanha_externa_id,
      titulo: item.titulo,
      valor_desconto: item.valor_desconto,
      compra_minima: bruto.compra_minima ?? null,
      validade: item.validade,
      escopo: bruto.escopo ?? null,
      acao: bruto.acao ?? null,
      tipo_acao: bruto.tipo_acao ?? null,
      possui_token_ativacao: Boolean(bruto.possui_token_ativacao),
      quantidade_produtos: itemIds.length,
      comissao_estimada_percentual: percentualComissao(comissao?.percentual),
      comissao_status: comissao?.status ?? null,
      comissao_item_id: comissao?.item_id ?? null,
      comissao_verificada_em: comissao?.verificada_em ?? null,
      produtos: itemIds.map((itemId: string, indice: number) => ({
        item_id: itemId,
        nome: produtos[indice]?.nome || null,
        imagem: produtos[indice]?.imagem || null,
        url: urlProdutoMl(itemId),
      })),
    };
  });

  return NextResponse.json({
    sucesso: true,
    candidatos,
  });
}
