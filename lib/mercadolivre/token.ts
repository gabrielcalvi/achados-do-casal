import { createClient } from "@supabase/supabase-js";

export type TokensMercadoLivre = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  user_id: number;
  expires_in: number;
};

function criarSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Credenciais administrativas do Supabase não configuradas."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
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
      {
        onConflict: "id",
      }
    );

  if (error) {
    throw new Error(
      `Erro ao salvar tokens do Mercado Livre: ${error.message}`
    );
  }
}

export async function buscarTokensMercadoLivre() {
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

  return data;
}