import { supabaseAdmin } from "@/lib/supabase/admin";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizarId(valor: string | null | undefined) {
  const texto = String(valor || "").toUpperCase().replace(/-/g, "");
  const match = texto.match(/MLB\d{8,}/);
  return match?.[0] || null;
}

function extrairItemId(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid"),
      url.searchParams.get("item_id"),
      url.searchParams.get("pdp_filters"),
      decodeURIComponent(url.hash || ""),
      decodeURIComponent(link),
    ];

    for (const candidato of candidatos) {
      const id = normalizarId(candidato);
      if (id) return id;
    }
  } catch {
    return normalizarId(link);
  }

  return null;
}

async function consultar(
  token: string,
  itemId: string,
  caminho: "sale_price" | "prices",
) {
  const url =
    caminho === "sale_price"
      ? `https://api.mercadolibre.com/items/${itemId}/sale_price?context=channel_marketplace`
      : `https://api.mercadolibre.com/items/${itemId}/prices`;

  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  const texto = await resposta.text();
  let json: Record<string, unknown> | null = null;

  try {
    json = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    json = null;
  }

  return {
    status: resposta.status,
    ok: resposta.ok,
    json,
    texto: json ? null : texto.slice(0, 300),
  };
}

export async function GET() {
  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,link,preco_atual,ativo,monitoramento_manual")
    .eq("loja", "Mercado Livre")
    .eq("ativo", true)
    .order("id");

  if (error) {
    return Response.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  const token = await obterAccessTokenMercadoLivre();
  const resultados = [];

  for (const produto of produtos || []) {
    const itemId = extrairItemId(String(produto.link || ""));

    if (!itemId) {
      resultados.push({
        produto_id: produto.id,
        nome: produto.nome,
        preco_banco: Number(produto.preco_atual),
        item_id: null,
        sucesso: false,
        erro: "ITEM_ID não identificado",
      });
      continue;
    }

    const [salePrice, prices] = await Promise.all([
      consultar(token, itemId, "sale_price"),
      consultar(token, itemId, "prices"),
    ]);

    const saleJson = salePrice.json as any;
    const pricesJson = prices.json as any;
    const lista = Array.isArray(pricesJson?.prices) ? pricesJson.prices : [];
    const marketplace = lista.filter((preco: any) => {
      const restricoes = preco?.conditions?.context_restrictions;
      return (
        !Array.isArray(restricoes) ||
        restricoes.length === 0 ||
        restricoes.includes("channel_marketplace")
      );
    });

    resultados.push({
      produto_id: produto.id,
      nome: produto.nome,
      item_id: itemId,
      preco_banco: Number(produto.preco_atual),
      sale_price: {
        status: salePrice.status,
        amount: Number.isFinite(Number(saleJson?.amount))
          ? Number(saleJson.amount)
          : null,
        regular_amount: Number.isFinite(Number(saleJson?.regular_amount))
          ? Number(saleJson.regular_amount)
          : null,
        currency_id: saleJson?.currency_id || null,
        reference_date: saleJson?.reference_date || null,
        erro: salePrice.ok ? null : saleJson?.message || saleJson?.error || salePrice.texto,
      },
      prices: {
        status: prices.status,
        quantidade: lista.length,
        marketplace: marketplace.map((preco: any) => ({
          id: preco?.id || null,
          type: preco?.type || null,
          amount: Number.isFinite(Number(preco?.amount))
            ? Number(preco.amount)
            : null,
          regular_amount: Number.isFinite(Number(preco?.regular_amount))
            ? Number(preco.regular_amount)
            : null,
          last_updated: preco?.last_updated || null,
          conditions: preco?.conditions || null,
        })),
        erro: prices.ok ? null : pricesJson?.message || pricesJson?.error || prices.texto,
      },
    });
  }

  return Response.json({
    sucesso: true,
    modo: "somente_leitura",
    quantidade: resultados.length,
    resultados,
  });
}
