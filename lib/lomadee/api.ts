import { supabaseAdmin } from "@/lib/supabase/admin";

const BASE_URL = "https://api.lomadee.com.br";
let chaveCache: string | null = null;

export type LomadeeBrand = {
  id: string;
  name: string;
  site?: string;
  logo?: string;
  slug?: string;
  commission?: { value?: number; transfer?: string };
  channels?: Array<{
    id?: string;
    name?: string;
    availableChannel?: { id?: string; name?: string };
    shortUrls?: string[];
    message?: string | null;
  }>;
};

export type LomadeeProduct = {
  organizationId: string;
  id: string;
  available: boolean;
  name: string;
  description?: string;
  url: string;
  images?: Array<{ url: string }>;
  options?: Array<{
    id: string;
    name?: string;
    available?: boolean;
    images?: Array<{ url: string }>;
    categories?: unknown[];
    pricing?: Array<{ listPrice?: number; price?: number }>;
  }>;
};

async function apiKey(chaveInformada?: string) {
  const direta = chaveInformada?.trim();
  if (direta) return direta;

  const ambiente = process.env.LOMADEE_API_KEY?.trim();
  if (ambiente) return ambiente;

  if (chaveCache) return chaveCache;

  const { data, error } = await supabaseAdmin.rpc("get_lomadee_api_key");
  if (error) throw new Error(`Falha ao ler a chave Lomadee do Vault: ${error.message}`);

  const chave = typeof data === "string" ? data.trim() : "";
  if (!chave) throw new Error("LOMADEE_API_KEY ainda não foi conectada.");
  chaveCache = chave;
  return chave;
}

async function lomadeeFetch<T>(path: string, init?: RequestInit, chaveInformada?: string): Promise<T> {
  const chave = await apiKey(chaveInformada);
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "x-api-key": chave,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(60000),
  });

  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    const detalhe = typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500);
    throw new Error(`Lomadee respondeu ${response.status}: ${detalhe}`);
  }

  return body as T;
}

export async function testarChaveLomadee(chave: string) {
  const resposta = await lomadeeFetch<{ data?: LomadeeBrand[]; pagination?: { total?: number } }>(
    "/affiliate/brands?page=1&limit=1",
    undefined,
    chave
  );
  return { totalMarcas: Number(resposta.pagination?.total || resposta.data?.length || 0) };
}

export async function salvarChaveLomadee(chave: string) {
  const valor = chave.trim();
  if (valor.length < 20) throw new Error("A chave Lomadee informada parece inválida.");
  const { error } = await supabaseAdmin.rpc("set_lomadee_api_key", { p_api_key: valor });
  if (error) throw new Error(`Falha ao guardar a chave Lomadee no Vault: ${error.message}`);
  chaveCache = valor;
}

export async function lomadeeConfigurada() {
  if (process.env.LOMADEE_API_KEY?.trim()) return true;
  if (chaveCache) return true;
  const { data, error } = await supabaseAdmin.rpc("get_lomadee_api_key");
  if (error) return false;
  const chave = typeof data === "string" ? data.trim() : "";
  if (chave) chaveCache = chave;
  return Boolean(chave);
}

export async function buscarMarcaLomadee(nome: string) {
  const qs = new URLSearchParams({ search: nome, page: "1", limit: "20" });
  const resposta = await lomadeeFetch<{ data?: LomadeeBrand[] }>(`/affiliate/brands?${qs}`);
  const termo = nome.toLowerCase();
  return (resposta.data || []).find((marca) => marca.name.toLowerCase().includes(termo)) || null;
}

export async function buscarProdutosLomadee(organizationId: string, limit = 16) {
  const qs = new URLSearchParams({
    organizationIds: organizationId,
    page: "1",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const resposta = await lomadeeFetch<{ data?: LomadeeProduct[]; meta?: { total?: number }; count?: number }>(`/affiliate/products?${qs}`);
  return {
    produtos: (resposta.data || []).filter((produto) => produto.available !== false),
    total: Number(resposta.meta?.total || resposta.count || resposta.data?.length || 0),
  };
}

export async function gerarDeeplinkLomadee(url: string, organizationId: string, mdasc?: string) {
  const resposta = await lomadeeFetch<Array<{
    id?: string;
    name?: string;
    availableChannel?: { id?: string; name?: string };
    shortUrls?: string[];
    message?: string | null;
  }>>("/affiliate/shortener/url", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      type: "Custom",
      url,
      ...(mdasc ? { mdasc } : {}),
    }),
  });

  const canais = Array.isArray(resposta) ? resposta : [];
  const preferido = canais.find((canal) => /achados\s*do\s*casal|achadosdocasal/i.test(`${canal.name || ""} ${canal.availableChannel?.name || ""}`)) || canais[0];
  const shortUrl = preferido?.shortUrls?.find((valor) => /^https?:\/\//i.test(valor || ""));
  if (!shortUrl) {
    const motivo = preferido?.message ? ` Motivo: ${preferido.message}` : "";
    throw new Error(`A Lomadee não retornou um deeplink para o canal do Achados do Casal.${motivo}`);
  }
  return shortUrl;
}
