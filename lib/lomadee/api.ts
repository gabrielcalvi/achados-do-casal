const BASE_URL = "https://api.lomadee.com.br";

export type LomadeeBrand = {
  id: string;
  name: string;
  site?: string;
  logo?: string;
  commission?: { value?: number; transfer?: string };
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

function apiKey() {
  const chave = process.env.LOMADEE_API_KEY?.trim();
  if (!chave) throw new Error("LOMADEE_API_KEY não configurada.");
  return chave;
}

async function lomadeeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(60000),
  });

  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!response.ok) {
    throw new Error(`Lomadee respondeu ${response.status}: ${typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  }

  return body as T;
}

export async function buscarMarcaLomadee(nome: string) {
  const qs = new URLSearchParams({ search: nome, page: "1", limit: "20" });
  const resposta = await lomadeeFetch<{ data?: LomadeeBrand[] }>(`/affiliate/brands?${qs}`);
  return (resposta.data || []).find((marca) => marca.name.toLowerCase().includes(nome.toLowerCase())) || null;
}

export async function buscarProdutosLomadee(organizationId: string, limit = 8) {
  const qs = new URLSearchParams({ organizationIds: organizationId, page: "1", limit: String(Math.min(Math.max(limit, 1), 100)), isAvailable: "true" });
  const resposta = await lomadeeFetch<{ data?: LomadeeProduct[] }>(`/affiliate/products?${qs}`);
  return resposta.data || [];
}

export async function gerarDeeplinkLomadee(url: string, organizationId: string, mdasc?: string) {
  const resposta = await lomadeeFetch<{ type?: Array<{ name?: string; availableChannel?: { name?: string }; shortUrls?: string[] }> }>("/affiliate/shortener/url", {
    method: "POST",
    body: JSON.stringify({ url, organizationId, type: "Custom", ...(mdasc ? { mdasc } : {}) }),
  });

  const canais = resposta.type || [];
  const preferido = canais.find((canal) => /achadosdocasal/i.test(`${canal.name || ""} ${canal.availableChannel?.name || ""}`)) || canais[0];
  const shortUrl = preferido?.shortUrls?.find((valor) => /^https?:\/\//i.test(valor || ""));
  if (!shortUrl) throw new Error("A Lomadee não retornou um deeplink para o canal do Achados do Casal.");
  return shortUrl;
}

export function lomadeeConfigurada() {
  return Boolean(process.env.LOMADEE_API_KEY?.trim());
}
