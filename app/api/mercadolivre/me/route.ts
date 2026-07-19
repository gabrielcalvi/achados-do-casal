import { NextResponse } from "next/server";
import { buscarTokensMercadoLivre } from "@/lib/mercadolivre/token";

export async function GET() {
  try {
    const tokens = await buscarTokensMercadoLivre();

    if (!tokens?.access_token) {
      return NextResponse.json(
        {
          error: "Token do Mercado Livre não encontrado no Supabase.",
        },
        {
          status: 401,
        }
      );
    }

    const resposta = await fetch(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tokens.access_token}`,
        },
        cache: "no-store",
      }
    );

    const texto = await resposta.text();

    return new NextResponse(texto, {
      status: resposta.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
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