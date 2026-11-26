import { supabaseAdmin } from "@/lib/supabase/admin";
import type { StorefrontOferta } from "@/components/PartnerStorefront";

export async function carregarOfertasIniciais(
  slug: string,
  limite = 80,
): Promise<StorefrontOferta[]> {
  const agora = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("economize_ofertas")
    .select(`
      id,titulo,descricao,codigo,categoria,imagem_url,
      desconto_percentual,preco_original,preco_oferta,
      loja:economize_lojas!inner(slug,ativa)
    `)
    .eq("status", "ativo")
    .eq("economize_lojas.ativa", true)
    .eq("economize_lojas.slug", slug)
    .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
    .or(`validade.is.null,validade.gt.${agora}`)
    .order("destaque", { ascending: false })
    .order("desconto_percentual", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("[SEO storefront] Falha ao carregar", slug, error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: String(item.id),
    titulo: String(item.titulo || ""),
    descricao: item.descricao ?? null,
    codigo: item.codigo ?? null,
    categoria: item.categoria ?? null,
    imagem_url: item.imagem_url ?? null,
    desconto_percentual:
      item.desconto_percentual === null ? null : Number(item.desconto_percentual),
    preco_original:
      item.preco_original === null ? null : Number(item.preco_original),
    preco_oferta:
      item.preco_oferta === null ? null : Number(item.preco_oferta),
  }));
}
