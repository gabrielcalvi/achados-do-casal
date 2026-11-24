import { NextResponse } from "next/server";
import {
  buscarItensDoUserProductMercadoLivre,
  buscarUserProductMercadoLivre,
} from "@/lib/mercadolivre/api";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_PRODUCT_ID = "MLBU5800013234";

async function bruto(url: string) {
  const token = await obterAccessTokenMercadoLivre();
  const resposta = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    status: resposta.status,
    texto: (await resposta.text()).slice(0, 50000),
  };
}

export async function GET() {
  const saida: Record<string, unknown> = {};

  try {
    saida.itemsFunc = await buscarItensDoUserProductMercadoLivre(USER_PRODUCT_ID);
  } catch (error) {
    saida.itemsFuncError = error instanceof Error ? error.message : String(error);
  }

  try {
    saida.userFunc = await buscarUserProductMercadoLivre(USER_PRODUCT_ID);
  } catch (error) {
    saida.userFuncError = error instanceof Error ? error.message : String(error);
  }

  saida.endpoints = await Promise.all([
    bruto(`https://api.mercadolibre.com/products/${USER_PRODUCT_ID}/items?attributes=results`),
    bruto(`https://api.mercadolibre.com/products/${USER_PRODUCT_ID}/items?include_attributes=all`),
    bruto(`https://api.mercadolibre.com/user-products/${USER_PRODUCT_ID}`),
    bruto(`https://api.mercadolibre.com/products/${USER_PRODUCT_ID}`),
    bruto(`https://api.mercadolibre.com/products/${USER_PRODUCT_ID}/pictures`),
  ]);

  return NextResponse.json(saida);
}
