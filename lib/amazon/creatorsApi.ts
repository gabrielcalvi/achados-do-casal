type AmazonCreatorsConfig = {
  credentialId: string;
  credentialSecret: string;
  credentialVersion: string;
  partnerTag: string;
  marketplace: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type CacheToken = {
  accessToken: string;
  expiraEm: number;
};

let cacheToken: CacheToken | null = null;

export type AmazonCreatorsItem = {
  asin?: string;
  detailPageURL?: string;
  images?: {
    primary?: {
      large?: { url?: string; width?: number; height?: number };
      medium?: { url?: string; width?: number; height?: number };
      small?: { url?: string; width?: number; height?: number };
    };
  };
  itemInfo?: {
    title?: { displayValue?: string };
    byLineInfo?: Record<string, unknown>;
    features?: { displayValues?: string[] };
  };
  offersV2?: {
    listings?: Array<{
      availability?: Record<string, unknown>;
      merchantInfo?: Record<string, unknown>;
      price?: {
        money?: {
          amount?: number;
          currency?: string;
          displayAmount?: string;
        };
        savingBasis?: {
          money?: {
            amount?: number;
            currency?: string;
            displayAmount?: string;
          };
          savingBasisType?: string;
          savingBasisTypeLabel?: string;
        };
        savings?: {
          money?: {
            amount?: number;
            currency?: string;
            displayAmount?: string;
          };
          percentage?: number;
        };
      };
      type?: string;
      isBuyBoxWinner?: boolean;
    }>;
  };
};

function config(): AmazonCreatorsConfig {
  const credentialId = process.env.AMAZON_CREATORS_CREDENTIAL_ID?.trim() || "";
  const credentialSecret = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET?.trim() || "";
  const credentialVersion = process.env.AMAZON_CREATORS_CREDENTIAL_VERSION?.trim() || "";
  const partnerTag = process.env.AMAZON_CREATORS_PARTNER_TAG?.trim() || "";
  const marketplace = process.env.AMAZON_CREATORS_MARKETPLACE?.trim() || "www.amazon.com.br";

  return {
    credentialId,
    credentialSecret,
    credentialVersion,
    partnerTag,
    marketplace,
  };
}

export function amazonCreatorsStatusConfig() {
  const cfg = config();
  const faltantes = [
    !cfg.credentialId ? "AMAZON_CREATORS_CREDENTIAL_ID" : null,
    !cfg.credentialSecret ? "AMAZON_CREATORS_CREDENTIAL_SECRET" : null,
    !cfg.credentialVersion ? "AMAZON_CREATORS_CREDENTIAL_VERSION" : null,
    !cfg.partnerTag ? "AMAZON_CREATORS_PARTNER_TAG" : null,
  ].filter(Boolean) as string[];

  return {
    configurado: faltantes.length === 0,
    faltantes,
    marketplace: cfg.marketplace,
    credentialVersion: cfg.credentialVersion || null,
    partnerTagConfigurado: Boolean(cfg.partnerTag),
  };
}

function tokenEndpoint(version: string) {
  if (version.startsWith("3.2")) return "https://api.amazon.co.uk/auth/o2/token";
  if (version.startsWith("3.3")) return "https://api.amazon.co.jp/auth/o2/token";
  return "https://api.amazon.com/auth/o2/token";
}

export async function amazonCreatorsToken() {
  const cfg = config();
  const status = amazonCreatorsStatusConfig();
  if (!status.configurado) {
    throw new Error(`Creators API não configurada. Faltam: ${status.faltantes.join(", ")}`);
  }

  const agora = Date.now();
  if (cacheToken && cacheToken.expiraEm - agora > 60_000) {
    return cacheToken.accessToken;
  }

  const resposta = await fetch(tokenEndpoint(cfg.credentialVersion), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: cfg.credentialId,
      client_secret: cfg.credentialSecret,
      scope: "creatorsapi::default",
    }),
  });

  const dados = (await resposta.json().catch(() => null)) as TokenResponse | Record<string, unknown> | null;
  if (!resposta.ok || !dados || !("access_token" in dados)) {
    const mensagem =
      dados && typeof dados === "object" && "message" in dados
        ? String(dados.message)
        : `HTTP ${resposta.status}`;
    throw new Error(`Falha ao autenticar na Amazon Creators API: ${mensagem}`);
  }

  const token = String((dados as TokenResponse).access_token);
  const expiresIn = Number((dados as TokenResponse).expires_in || 3600);
  cacheToken = {
    accessToken: token,
    expiraEm: agora + Math.max(60, expiresIn) * 1000,
  };
  return token;
}

export async function amazonCreatorsGetItems(asins: string[]) {
  const cfg = config();
  const status = amazonCreatorsStatusConfig();
  if (!status.configurado) {
    throw new Error(`Creators API não configurada. Faltam: ${status.faltantes.join(", ")}`);
  }

  const ids = [...new Set(asins.map((asin) => asin.trim().toUpperCase()).filter(Boolean))].slice(0, 10);
  if (ids.length === 0) throw new Error("Informe ao menos um ASIN.");

  const token = await amazonCreatorsToken();

  const resposta = await fetch("https://creatorsapi.amazon/catalog/v1/getItems", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-marketplace": cfg.marketplace,
    },
    cache: "no-store",
    body: JSON.stringify({
      itemIds: ids,
      itemIdType: "ASIN",
      marketplace: cfg.marketplace,
      partnerTag: cfg.partnerTag,
      languagesOfPreference: ["pt_BR"],
      currencyOfPreference: "BRL",
      resources: [
        "images.primary.large",
        "images.primary.medium",
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "itemInfo.features",
        "offersV2.listings.availability",
        "offersV2.listings.isBuyBoxWinner",
        "offersV2.listings.merchantInfo",
        "offersV2.listings.price",
        "offersV2.listings.type",
      ],
    }),
  });

  const dados = (await resposta.json().catch(() => null)) as Record<string, any> | null;
  if (!resposta.ok) {
    const mensagem = dados?.message || dados?.reason || `HTTP ${resposta.status}`;
    throw new Error(`Falha no GetItems da Amazon: ${mensagem}`);
  }

  const itens =
    dados?.itemResults?.items ||
    dados?.itemsResult?.items ||
    [];

  return {
    itens: itens as AmazonCreatorsItem[],
    erros: dados?.errors || [],
    bruto: dados,
  };
}

export async function amazonCreatorsSearchItems(keywords: string, itemCount = 10) {
  const cfg = config();
  const status = amazonCreatorsStatusConfig();
  if (!status.configurado) {
    throw new Error(`Creators API não configurada. Faltam: ${status.faltantes.join(", ")}`);
  }

  const termo = keywords.trim();
  if (!termo) throw new Error("Informe palavras-chave para buscar.");

  const token = await amazonCreatorsToken();
  const resposta = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-marketplace": cfg.marketplace,
    },
    cache: "no-store",
    body: JSON.stringify({
      partnerTag: cfg.partnerTag,
      marketplace: cfg.marketplace,
      keywords: termo,
      searchIndex: "All",
      itemCount: Math.min(Math.max(itemCount, 1), 10),
      languagesOfPreference: ["pt_BR"],
      currencyOfPreference: "BRL",
      resources: [
        "images.primary.large",
        "itemInfo.title",
        "offersV2.listings.price",
      ],
    }),
  });

  const dados = (await resposta.json().catch(() => null)) as Record<string, any> | null;
  if (!resposta.ok) {
    const mensagem = dados?.message || dados?.reason || `HTTP ${resposta.status}`;
    throw new Error(`Falha no SearchItems da Amazon: ${mensagem}`);
  }

  return dados;
}
