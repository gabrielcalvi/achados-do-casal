import { NextRequest, NextResponse } from "next/server";
import { buscarProdutoMercadoLivre } from "@/lib/mercadolivre/api";

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get("id");

    if (!itemId) {
      return NextResponse.json(
        {
          error: "Informe um ITEM_ID. Exemplo: ?id=MLB1234567890",
        },
        {
          status: 400,
        }
      );
    }

    const produto = await buscarProdutoMercadoLivre(itemId);

    return NextResponse.json(produto);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido",
      },
      {
        status: 500,
      }
    );
  }
}