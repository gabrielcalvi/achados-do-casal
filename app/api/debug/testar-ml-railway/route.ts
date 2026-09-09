import { NextResponse } from "next/server";
import { obterAccessTokenMercadoLivre } from "@/lib/mercadolivre/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BASE = "https://heroic-benevolence-production-1ccf.up.railway.app";
const SELLER_ID = "394062031";
const USER_PRODUCT_ID = "MLBU3388038385";

const LINKS = {
  uppLimpa:
    "https://www.mercadolivre.com.br/kit-pa--enxada-antifaiscante-plastica-cabo-de-madeira-50cm/up/MLBU3388038385",
  itemCanonico:
    "https://produto.mercadolivre.com.br/MLB-5652208776-_JM",
  itemSemHifen:
    "https://produto.mercadolivre.com.br/MLB5652208776",
};

async function ler(url: string, timeout = 30000, headers?: HeadersInit) {
  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(timeout),
    });
    return {
      status: resposta.status,
      urlFinal: resposta.url,
      corpo: (await resposta.text()).slice(0, 20000),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET() {
  const resultado: Record<string, unknown> = {};

  resultado.health = await ler(`${BASE}/health`, 15000);

  // A rota antiga aquecia/reutilizava um perfil persistente do navegador.
  resultado.loginWarmup = await ler(`${BASE}/login`, 45000);

  const worker: Record<string, unknown> = {};
  for (const [nome, link] of Object.entries(LINKS)) {
    worker[nome] = await ler(
      `${BASE}/extrair?url=${encodeURIComponent(link)}`,
      90000
    );
  }
  resultado.worker = worker;

  const token = await obterAccessTokenMercadoLivre();
  const auth = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const endpointsOficiais = [
    `https://api.mercadolibre.com/users/${SELLER_ID}/items/search?user_product_id=${USER_PRODUCT_ID}`,
    `https://api.mercadolibre.com/users/${SELLER_ID}/items/search?status=active&user_product_id=${USER_PRODUCT_ID}`,
    `https://api.mercadolibre.com/users/${SELLER_ID}/items/search?user_product_id=${USER_PRODUCT_ID}&attributes=results,paging,orders` ,
    `https://api.mercadolibre.com/items/MLB5652208776/description`,
  ];

  resultado.oficial = await Promise.all(
    endpointsOficiais.map(async (url) => ({
      url,
      resposta: await ler(url, 30000, auth),
    }))
  );

  return NextResponse.json(resultado);
}
