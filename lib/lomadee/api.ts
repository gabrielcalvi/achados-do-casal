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

export type LomadeeCampaign = {
  id: string;
  name: string;
  period?: { startAt?: string; endAt?: string };
  type?: "PersonalCoupon" | "GenericCoupon" | "Offer" | string;
  offerType?: "Spreadsheet" | "Url" | string;
  categories?: string[];
  description?: string;
  code?: string;
  url?: string;
  organizationId: string;
  isHighlight?: boolean;
  status?: "onTime" | "expired" | "scheduled" | string;
  createdAt?: string;
  channels?: Array<{
    id?: string;
    name?: string;
    availableChannel?: { id?: string; name?: string };
    shortUrls?: string[];
    message?: string | null;
  }>;
  mediaKit?: { banners?: string[]; emailMarketing?: unknown };
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

type ResultadoEscopoLomadee = {
  nome: string;
  escopo: string;
  ok: boolean;
  status?: number | null;
  total?: number | null;
  detalhe?: string | null;
};

function statusDoErroLomadee(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const match = mensagem.match(/Lomadee respondeu (\d{3})/);
  return match?.[1] ? Number(match[1]) : null;
}

async function testarEscopoLomadee(
  nome: string,
  escopo: string,
  executar: () => Promise<{ total?: number | null; detalhe?: string | null }>
): Promise<ResultadoEscopoLomadee> {
  try {
    const resultado = await executar();
    return {
      nome,
      escopo,
      ok: true,
      status: 200,
      total: resultado.total ?? null,
      detalhe: resultado.detalhe ?? null,
    };
  } catch (erro) {
    const status = statusDoErroLomadee(erro);
    return {
      nome,
      escopo,
      ok: false,
      status,
      total: null,
      detalhe:
        status === 403
          ? "Chave válida, mas este escopo não foi liberado."
          : erro instanceof Error
            ? erro.message
            : String(erro),
    };
  }
}

export async function diagnosticarLomadee() {
  const marcas = await lomadeeFetch<{
    data?: LomadeeBrand[];
    pagination?: { total?: number };
  }>("/affiliate/brands?page=1&limit=20");

  const totalMarcas = Number(
    marcas.pagination?.total || marcas.data?.length || 0
  );
  const marcaParaTeste =
    (marcas.data || []).find((marca) =>
      marca.channels?.some((canal) => !canal.message)
    ) ||
    marcas.data?.[0] ||
    null;

  const escopos = await Promise.all([
    testarEscopoLomadee("Marcas", "brands:read", async () => ({
      total: totalMarcas,
    })),
    testarEscopoLomadee("Canais", "channels:read", async () => {
      const resposta = await lomadeeFetch<{
        data?: Array<{ id?: string; name?: string }>;
        count?: number;
      }>("/affiliate/channels");
      return {
        total: Number(resposta.count || resposta.data?.length || 0),
      };
    }),
    testarEscopoLomadee("Campanhas e cupons", "campaigns:read", async () => {
      const resposta = await lomadeeFetch<{
        data?: unknown[];
        meta?: { total?: number };
      }>("/affiliate/campaigns?page=1&limit=1");
      return {
        total: Number(resposta.meta?.total || resposta.data?.length || 0),
      };
    }),
    testarEscopoLomadee("Produtos", "products:read", async () => {
      const resposta = await lomadeeFetch<{
        data?: LomadeeProduct[];
        count?: number;
      }>("/affiliate/products?page=1&limit=1");
      return {
        total: Number(resposta.count || resposta.data?.length || 0),
      };
    }),
    testarEscopoLomadee("Pedidos e comissões", "orders:read", async () => {
      const resposta = await lomadeeFetch<{
        data?: unknown[];
        meta?: { total?: number };
      }>("/affiliate/orders?page=1&limit=1");
      return {
        total: Number(resposta.meta?.total || resposta.data?.length || 0),
      };
    }),
    testarEscopoLomadee("Links existentes", "shortener:read", async () => {
      const resposta = await lomadeeFetch<{
        data?: unknown[];
        meta?: { total?: number };
      }>("/affiliate/shortener/urls?page=1&limit=1");
      return {
        total: Number(resposta.meta?.total || resposta.data?.length || 0),
      };
    }),
    testarEscopoLomadee("Gerar deeplink", "shortener:write", async () => {
      if (!marcaParaTeste?.id) {
        throw new Error("Nenhuma marca acessível para testar deeplink.");
      }

      const resposta = await lomadeeFetch<
        Array<{
          shortUrls?: string[];
          message?: string | null;
        }>
      >("/affiliate/shortener/url", {
        method: "POST",
        body: JSON.stringify({
          organizationId: marcaParaTeste.id,
          type: "Home",
          mdasc: "homologacao-achados-do-casal",
        }),
      });

      const urlGerada = (Array.isArray(resposta) ? resposta : [])
        .flatMap((canal) => canal.shortUrls || [])
        .find((url) => /^https?:\/\//i.test(url));

      return {
        total: urlGerada ? 1 : 0,
        detalhe: urlGerada
          ? "Deeplink de homologação gerado com sucesso."
          : "Escopo respondeu, mas nenhum canal devolveu URL.",
      };
    }),
  ]);

  const canais = escopos.find((item) => item.escopo === "channels:read");

  return {
    totalMarcas,
    totalCanais: canais?.total ?? 0,
    escopos,
    homologacaoTecnicaOk: escopos.every((item) => item.ok),
  };
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

export async function listarMarcasLomadee() {
  const resultado: LomadeeBrand[] = [];
  const limite = 20;

  for (let pagina = 1; pagina <= 50; pagina += 1) {
    const resposta = await lomadeeFetch<{
      data?: LomadeeBrand[];
      pagination?: { total?: number; page?: number; totalPages?: number };
      meta?: { total?: number; page?: number; totalPages?: number };
    }>(`/affiliate/brands?page=${pagina}&limit=${limite}`);

    const itens = Array.isArray(resposta.data) ? resposta.data : [];
    resultado.push(...itens);
    const totalPaginas = Number(
      resposta.pagination?.totalPages || resposta.meta?.totalPages || 0,
    );
    if ((totalPaginas > 0 && pagina >= totalPaginas) || itens.length < limite) {
      break;
    }
  }

  return resultado;
}

export async function listarCampanhasLomadeeAtivas() {
  const resultado: LomadeeCampaign[] = [];
  const limite = 20;

  for (let pagina = 1; pagina <= 150; pagina += 1) {
    const qs = new URLSearchParams({
      page: String(pagina),
      limit: String(limite),
      status: "onTime",
      types: "PersonalCoupon,GenericCoupon,Offer",
    });
    const resposta = await lomadeeFetch<{
      data?: LomadeeCampaign[];
      meta?: { total?: number; page?: number; totalPages?: number };
    }>(`/affiliate/campaigns?${qs}`);

    const itens = Array.isArray(resposta.data) ? resposta.data : [];
    resultado.push(...itens);
    const totalPaginas = Number(resposta.meta?.totalPages || 0);
    if ((totalPaginas > 0 && pagina >= totalPaginas) || itens.length < limite) {
      break;
    }
  }

  return resultado;
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

export async function gerarDeeplinkLomadee(
  url: string,
  organizationId: string,
  mdasc?: string,
  featureId?: string,
) {
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
      ...(featureId ? { featureId } : { type: "Custom" }),
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
