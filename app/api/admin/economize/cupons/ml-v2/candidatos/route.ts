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
      "id,campanha_externa_id,titulo,valor_desconto,validade,status,dados_brutos,top_produtos,cupom_publicado_id,publicado_em"
    )
    .eq("origem", "mercado_livre_v2")
    .in("status", ["aprovado", "publicado"])
    .order("aprovado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }

  const candidatos = (data || []).map((item) => {
    const bruto = (item.dados_brutos || {}) as Record<string, any>;
    const itemIds = Array.isArray(bruto.item_ids) ? bruto.item_ids : [];
    const produtos = Array.isArray(item.top_produtos) ? item.top_produtos : [];

    return {
      id: item.id,
      campanha_id: item.campanha_externa_id,
      titulo: item.titulo,
      valor_desconto: item.valor_desconto,
      compra_minima: bruto.compra_minima ?? null,
      validade: item.validade,
      status: item.status,
      cupom_publicado_id: item.cupom_publicado_id,
      publicado_em: item.publicado_em,
      itens: itemIds.map((itemId: string, indice: number) => ({
        item_id: itemId,
        nome: produtos[indice]?.nome || null,
        imagem: produtos[indice]?.imagem || null,
        url: urlProdutoMl(itemId),
      })),
    };
  });

  return NextResponse.json({ sucesso: true, candidatos });
}
