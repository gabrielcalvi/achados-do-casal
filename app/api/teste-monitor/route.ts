import { NextResponse } from "next/server";
import { consultarPrecoProduto } from "@/lib/services/priceMonitor";

export async function GET() {
  try {
    const resultado = await consultarPrecoProduto(18);

    return NextResponse.json({
      sucesso: true,
      produto: resultado.produto.nome,
      dados: resultado.dadosAtuais,
    });
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}