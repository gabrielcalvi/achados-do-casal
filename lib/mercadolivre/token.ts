import { createClient } from "@supabase/supabase-js";

export type TokensMercadoLivre = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  user_id: number;
  expires_in: number;
};

type TokensSalvosMercadoLivre = TokensMercadoLivre & {
  id?: number;
  expires_at?: string | null;
  updated_at?: string | null;
};

type RespostaRefreshMercadoLivre = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  user_id: number;
  expires_in: number;
};

function criarSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Credenciais administrativas do Supabase não configuradas."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function salvarTokensMercadoLivre(
  tokens: TokensMercadoLivre
) {
  const supabase = criarSupabaseAdmin();

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { error } = await supabase
    .from("mercado_livre_tokens")
    .upsert(
      {
        id: 1,
        user_id: tokens.user_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || "Bearer",
        scope: tokens.scope || null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(
      `Erro ao salvar tokens do Mercado Livre: ${error.message}`
    );
  }
}

export async function buscarTokensMercadoLivre(): Promise<TokensSalvosMercadoLivre | null> {
  const supabase = criarSupabaseAdmin();

  const { data, error } = await supabase
    .from("mercado_livre_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao buscar tokens do Mercado Livre: ${error.message}`
    );
  }

  return data as TokensSalvosMercadoLivre | null;
}

async function renovarAccessTokenMercadoLivre(
  refreshToken: string
): Promise<string> {
  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Credenciais OAuth do Mercado Livre não configuradas."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
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

  const texto = await resposta.text();

  if (!resposta.ok) {
    throw new Error(
      `Falha ao renovar token do Mercado Livre (${resposta.status}): ${texto}`
    );
  }

  const novoToken = JSON.parse(texto) as RespostaRefreshMercadoLivre;

  await salvarTokensMercadoLivre(novoToken);

  return novoToken.access_token;
}

export async function obterAccessTokenMercadoLivre(): Promise<string> {
  const tokens = await buscarTokensMercadoLivre();

  if (!tokens?.access_token) {
    throw new Error(
      "Não foi encontrado um token do Mercado Livre no Supabase."
    );
  }

  const expiraEm = tokens.expires_at
    ? new Date(tokens.expires_at).getTime()
    : 0;

  const aindaValido =
    Number.isFinite(expiraEm) && expiraEm > Date.now() + 60_000;

  if (aindaValido) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error(
      "O token do Mercado Livre expirou e não há refresh token disponível."
    );
  }

  return renovarAccessTokenMercadoLivre(tokens.refresh_token);
}
