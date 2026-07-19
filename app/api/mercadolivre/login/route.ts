import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.MELI_CLIENT_ID;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "MELI_CLIENT_ID ou MELI_REDIRECT_URI não foi configurado.",
      },
      {
        status: 500,
      }
    );
  }

  const state = randomBytes(24).toString("hex");

  const urlAutorizacao = new URL(
    "https://auth.mercadolivre.com.br/authorization"
  );

  urlAutorizacao.searchParams.set(
    "response_type",
    "code"
  );

  urlAutorizacao.searchParams.set(
    "client_id",
    clientId
  );

  urlAutorizacao.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  urlAutorizacao.searchParams.set(
    "state",
    state
  );

  const resposta = NextResponse.redirect(
    urlAutorizacao
  );

  resposta.cookies.set(
    "meli_oauth_state",
    state,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    }
  );

  return resposta;
}