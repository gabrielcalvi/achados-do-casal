import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = Array.from(
    new Set(
      String(url.searchParams.get("ids") || "")
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ).slice(0, 100);

  if (!ids.length) return Response.json({ produtos: [] });

  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,loja,categoria,imagem,preco_antigo,preco_atual,ativo,avaliacao,frete_gratis,parcelas,tem_em_casa,review_completa,nota_casal")
    .in("id", ids);

  if (error) {
    return Response.json({ erro: "Não foi possível carregar os produtos." }, { status: 500 });
  }

  const ordem = new Map(ids.map((id, index) => [id, index]));
  const produtos = (data || []).sort(
    (a, b) => (ordem.get(Number(a.id)) ?? 999) - (ordem.get(Number(b.id)) ?? 999),
  );

  return Response.json({ produtos });
}
