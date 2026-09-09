import { NextResponse } from "next/server";
import {
  buscarItensDoCatalogoMercadoLivre,
  buscarProdutosCatalogoMercadoLivre,
} from "@/lib/mercadolivre/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ITEM_ID = "MLB5652208776";
const USER_PRODUCT_ID = "MLBU3388038385";

const TERMOS = [
  "kit pa enxada antifaiscante plastica cabo de madeira 50cm",
  "pa enxada antifaiscante",
  "enxada antifaiscante",
  "antifaiscante plastica",
  "pa enxada plastica",
];

function normalizar(valor: string | null | undefined) {
  return String(valor || "").toUpperCase().replace(/-/g, "").trim();
}

export async function GET() {
  const tentativas: Array<Record<string, unknown>> = [];
  const vistos = new Set<string>();

  for (const termo of TERMOS) {
    let produtos;
    try {
      produtos = await buscarProdutosCatalogoMercadoLivre(termo, 12);
    } catch (error) {
      tentativas.push({
        termo,
        erroBusca: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const produto of produtos) {
      if (!produto?.id || vistos.has(produto.id)) continue;
      vistos.add(produto.id);

      try {
        const lista = await buscarItensDoCatalogoMercadoLivre(produto.id);
        const exato = (lista.results || []).find((item) =>
          normalizar(item.item_id) === ITEM_ID ||
          normalizar(item.user_product_id) === USER_PRODUCT_ID
        );

        tentativas.push({
          termo,
          catalogo: produto.id,
          nome: produto.name,
          totalItens: lista.results?.length || 0,
          exato: Boolean(exato),
          itemExato: exato || null,
          imagens: exato
            ? (produto.pictures || []).map((p) => p.secure_url || p.url).filter(Boolean)
            : [],
        });

        if (exato) {
          return NextResponse.json({
            encontrado: true,
            termo,
            catalogo: produto,
            item: exato,
            tentativas,
          });
        }
      } catch (error) {
        tentativas.push({
          termo,
          catalogo: produto.id,
          nome: produto.name,
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return NextResponse.json({
    encontrado: false,
    itemId: ITEM_ID,
    userProductId: USER_PRODUCT_ID,
    catalogosConsultados: vistos.size,
    tentativas,
  });
}
