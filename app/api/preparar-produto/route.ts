import { NextResponse } from "next/server";
import { extrairProduto } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPO_LIMITE = 600000;

async function executarComTimeout<T>(
  operacao: Promise<T>,
  tempo: number
): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    temporizador = setTimeout(() => {
      reject(
        new Error(
          "A extração demorou mais de 10 minutos. Tente novamente."
        )
      );
    }, tempo);
  });

  try {
    return await Promise.race([operacao, timeout]);
  } finally {
    if (temporizador) {
      clearTimeout(temporizador);
    }
  }
}

export async function POST(request: Request) {
  try {
    const corpo = await request.json();
    const link = String(corpo?.link || "").trim();

    if (!link) {
      return NextResponse.json(
        {
          error: "Link não informado.",
        },
        {
          status: 400,
        }
      );
    }

    try {
      new URL(link);
    } catch {
      return NextResponse.json(
        {
          error: "O link informado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    const dados = await executarComTimeout(
      extrairProduto(link),
      TEMPO_LIMITE
    );

    console.log("DADOS RETORNADOS:", dados);

    return NextResponse.json({
      sucesso: true,
      dados,
    });
  } catch (error) {
    console.error("ERRO AO PREPARAR PRODUTO:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao preparar o produto.",
      },
      {
        status: 500,
      }
    );
  }
}