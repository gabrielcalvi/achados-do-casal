import { NextResponse } from "next/server";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_PRODUCT_ID = "MLBU3388038385";
const ITEM_ID = "MLB5652208776";

const CAMINHOS = [
  `/user-products/${USER_PRODUCT_ID}`,
  `/user-products/${USER_PRODUCT_ID}/items`,
  `/user-products/${USER_PRODUCT_ID}/sellers`,
  `/user-products/${USER_PRODUCT_ID}/buy_box`,
  `/user-products/${USER_PRODUCT_ID}/buy-box`,
  `/items/${ITEM_ID}/user_product`,
  `/items/${ITEM_ID}/user-products`,
  `/products/${USER_PRODUCT_ID}`,
  `/products/${USER_PRODUCT_ID}/items`,
];

async function testar(url: string, token?: string) {
  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });

    const texto = await resposta.text();
    return {
      status: resposta.status,
      ok: resposta.ok,
      corpo: texto.slice(0, 12000),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const token = await obterAccessTokenMercadoLivre();
  const resultados = [];

  for (const caminho of CAMINHOS) {
    const url = `https://api.mercadolibre.com${caminho}`;
    resultados.push({
      caminho,
      semToken: await testar(url),
      comToken: await testar(url, token),
    });
  }

  return NextResponse.json({ resultados });
}
