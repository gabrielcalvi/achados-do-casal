import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { salvarTokensMercadoLivre } from "@/lib/mercadolivre/token";

type RespostaTokenMercadoLivre = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
};

export async function GET(request: NextRequest) {
  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: "Credenciais do Mercado Livre não configuradas.",
      },
      {
        status: 500,
      }
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateRecebido =
    request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const stateSalvo =
    cookieStore.get("meli_oauth_state")?.value;

  if (!code) {
    return NextResponse.json(
      {
        error:
          "O Mercado Livre não enviou o código de autorização.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !stateRecebido ||
    !stateSalvo ||
    stateRecebido !== stateSalvo
  ) {
    return NextResponse.json(
      {
        error:
          "Falha na validação de segurança do OAuth.",
      },
      {
        status: 400,
      }
    );
  }

  const corpo = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const resposta = await fetch(
    "https://api.mercadolibre.com/oauth/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: corpo.toString(),
      cache: "no-store",
    }
  );

  const texto = await resposta.text();

  if (!resposta.ok) {
    console.error(
      "ERRO AO TROCAR CODE POR TOKEN:",
      resposta.status,
      texto
    );

    return NextResponse.json(
      {
        error: "Não foi possível obter o token.",
        status: resposta.status,
        detalhe: texto,
      },
      {
        status: 500,
      }
    );
  }

  const tokens = JSON.parse(
    texto
  ) as RespostaTokenMercadoLivre;

 await salvarTokensMercadoLivre(tokens);

const respostaFinal = NextResponse.redirect(
  new URL("/admin?mercadolivre=conectado", request.url)
);

respostaFinal.cookies.delete("meli_oauth_state");

return respostaFinal;
}