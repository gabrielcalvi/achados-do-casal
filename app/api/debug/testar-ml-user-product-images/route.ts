import { NextResponse } from "next/server";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_PRODUCT_ID = "MLBU3388038385";
const ITEM_ID = "MLB5652208776";

const URLS = [
  `https://api.mercadolibre.com/products/${USER_PRODUCT_ID}/items?attributes=results.item_id,results.price,results.original_price,results.user_product_id,results.pictures,results.thumbnail,results.secure_thumbnail`,
  `https://api.mercadolibre.com/user-products/${USER_PRODUCT_ID}?attributes=id,title,pictures,thumbnail,attributes`,
  `https://api.mercadolibre.com/items/${ITEM_ID}?attributes=id,title,pictures,thumbnail,secure_thumbnail`,
  `https://api.mercadolibre.com/items/${ITEM_ID}/pictures`,
  `https://api.mercadolibre.com/items/${ITEM_ID}/variations`,
  `https://api.mercadolibre.com/products/${USER_PRODUCT_ID}/pictures`,
];

export async function GET() {
  const token = await obterAccessTokenMercadoLivre();
  const resultados = [];

  for (const url of URLS) {
    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(20000),
      });
      const texto = await resposta.text();
      resultados.push({ url, status: resposta.status, ok: resposta.ok, corpo: texto.slice(0, 20000) });
    } catch (error) {
      resultados.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ resultados });
}
