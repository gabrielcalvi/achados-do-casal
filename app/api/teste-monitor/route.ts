import { NextRequest, NextResponse } from "next/server";
import { consultarPrecoProduto } from "@/lib/services/priceMonitor";

export async function GET(
  request: NextRequest
) {
  const parametroId =
    request.nextUrl.searchParams.get(
      "id"
    );

  const produtoId = Number(
    parametroId
  );

  if (
    !Number.isInteger(produtoId) ||
    produtoId <= 0
  ) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          "Informe um produto válido usando ?id=NUMERO.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const resultado =
      await consultarPrecoProduto(
        produtoId
      );

    return NextResponse.json({
      sucesso: true,
      produtoId,
      produto:
        resultado.produto,
      precoBanco:
        resultado.precoBanco,
      precoNovo:
        resultado.precoNovo,
      precoMudou:
        resultado.precoMudou,
      dados:
        resultado.dadosAtuais,
    });
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        produtoId,
        erro:
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