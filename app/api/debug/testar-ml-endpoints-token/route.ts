import { NextResponse } from "next/server";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEM_ID = "MLB5982398014";
const PRODUCT_ID = "MLB26264031";
const USER_PRODUCT_ID = "MLBU749693303";

export async function GET() {
  const token = await obterAccessTokenMercadoLivre();
  const urls = [
    `https://api.mercadolibre.com/items/bulk?ids=${ITEM_ID}`,
    `https://api.mercadolibre.com/items/${ITEM_ID}/prices`,
    `https://api.mercadolibre.com/items/${ITEM_ID}/sale_price`,
    `https://api.mercadolibre.com/products/${PRODUCT_ID}`,
    `https://api.mercadolibre.com/products/${PRODUCT_ID}/items`,
    `https://api.mercadolibre.com/products/${PRODUCT_ID}/items?status=active`,
    `https://api.mercadolibre.com/user-products/${USER_PRODUCT_ID}`,
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent("Kit 2 expositor de esmaltes de parede com led mdf preto")}&limit=5`,
  ];

  const resultados = [];

  for (const url of urls) {
    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(30000),
      });
      const texto = await resposta.text();
      resultados.push({
        url,
        status: resposta.status,
        ok: resposta.ok,
        corpo: texto.slice(0, 20000),
      });
    } catch (error) {
      resultados.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ resultados });
}
