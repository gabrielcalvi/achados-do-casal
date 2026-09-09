import { NextResponse } from "next/server";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UP = "MLBU3388038385";
const ITEM = "MLB5652208776";

const URLS = [
  `https://api.mercadolibre.com/products/${UP}/items?attributes=results`,
  `https://api.mercadolibre.com/products/${UP}/items?attributes=results.item_id,results.user_product_id,results.catalog_product_id,results.family_id,results.family_name,results.picture_ids,results.pictures,results.thumbnail,results.secure_thumbnail,results.price,results.original_price`,
  `https://api.mercadolibre.com/products/${UP}/items?include_attributes=all`,
  `https://api.mercadolibre.com/items/${ITEM}/variations?attributes=id,picture_ids,catalog_product_id,user_product_id`,
  `https://api.mercadolibre.com/items/${ITEM}/description`,
  `https://api.mercadolibre.com/items/${ITEM}/sale_price`,
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
      resultados.push({
        url,
        status: resposta.status,
        corpo: (await resposta.text()).slice(0, 30000),
      });
    } catch (error) {
      resultados.push({
        url,
        erro: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ resultados });
}
