import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEM_ID = "MLB5982398014";
const PRODUCT_ID = "MLB26264031";

export async function GET() {
  const urls = [
    `https://api.mercadolibre.com/items/${ITEM_ID}`,
    `https://api.mercadolibre.com/items/${ITEM_ID}?attributes=id,title,price,original_price,currency_id,permalink,thumbnail,pictures,shipping,sold_quantity,category_id`,
    `https://api.mercadolibre.com/products/${PRODUCT_ID}`,
    `https://api.mercadolibre.com/products/${PRODUCT_ID}/items`,
    `https://api.mercadolibre.com/sites/MLB/search?q=${ITEM_ID}`,
    `https://api.mercadolibre.com/sites/MLB/search?q=${PRODUCT_ID}`,
    `https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=${PRODUCT_ID}`,
  ];

  const resultados = [];

  for (const url of urls) {
    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      const texto = await resposta.text();
      resultados.push({ url, status: resposta.status, ok: resposta.ok, corpo: texto.slice(0, 25000) });
    } catch (error) {
      resultados.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ resultados });
}
