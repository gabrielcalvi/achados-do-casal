import { redirect } from "next/navigation";
import PartnerStorefront from "@/components/PartnerStorefront";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function LauriEsportePage() {
  const { count, error } = await supabaseAdmin
    .from("economize_ofertas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo")
    .eq("loja_id", (
      await supabaseAdmin
        .from("economize_lojas")
        .select("id")
        .eq("slug", "lauri-esporte")
        .maybeSingle()
    ).data?.id || "");

  if (error || !count) redirect("/economize");

  return (
    <PartnerStorefront
      slug="lauri-esporte"
      nome="Lauri Esporte"
      descricao="Tênis e artigos esportivos de marcas fortes, publicados pelo Achados do Casal somente quando o feed oficial da Awin mostra desconto real e link afiliado válido."
      placeholder="Buscar tênis, corrida, academia, chuteira..."
      cor="#111827"
    />
  );
}
