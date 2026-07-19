import { NextResponse } from "next/server";
import {
  buscarTokensMercadoLivre,
  salvarTokensMercadoLivre,
} from "@/lib/mercadolivre/token";

type RespostaToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
};

export async function POST() {
  try {
    const tokensAtuais = await buscarTokensMercadoLivre();

    if (!tokensAtuais?.refresh_token) {
      return NextResponse.json(
        {
          error:
            "Nenhum refresh token foi encontrado. Autorize novamente a conta do Mercado Livre.",
        },
        { status: 401 }
      );
    }

    const clientId = process.env.MELI_CLIENT_ID;
const clientSecret = process.env.MELI_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "MERCADO_LIVRE_CLIENT_ID ou MERCADO_LIVRE_CLIENT_SECRET não configurados.",
        },
        { status: 500 }
      );
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokensAtuais.refresh_token,
    });

    const resposta = await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      return NextResponse.json(
        {
          error: "O Mercado Livre recusou a renovação do token.",
          details: dados,
        },
        { status: resposta.status }
      );
    }

    const novoToken = dados as RespostaToken;

    await salvarTokensMercadoLivre({
      user_id: novoToken.user_id,
      access_token: novoToken.access_token,
      refresh_token: novoToken.refresh_token,
      token_type: novoToken.token_type,
      scope: novoToken.scope,
      expires_in: novoToken.expires_in,
       
    });

    return NextResponse.json({
      success: true,
      message: "Token do Mercado Livre renovado com sucesso.",
      expires_in: novoToken.expires_in,
    });
  } catch (error) {
    console.error("Erro ao renovar token do Mercado Livre:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao renovar o token.",
      },
      { status: 500 }
    );
  }
}