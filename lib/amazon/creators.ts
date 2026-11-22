const AMAZON_API_BASE = "https://creatorsapi.amazon";
const AMAZON_MARKETPLACE_BR = "www.amazon.com.br";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export type AmazonCreatorsConfig = {
  clientId: string;
  clientSecret: string;
  credentialVersion: string;
  partnerTag: string;
  marketplace: string;
};

export type AmazonSearchItem = {
  asin?: string;
  detailPageURL?: string;
  images?: {
    primary?: {
      medium?: {
        url?: string;
        width?: number;
        height?: number;
      };
    };
  };
  itemInfo?: {
    title?: {
      displayValue?: string;
    };
  };
  offersV2?: {
    listings?: Array<{
      availability?: {
        type?: string;
        message?: string;
      };
      dealDetails?: {
        accessType?: string;
        badge?: string;
        startTime?: string;
        endTime?: string;
        percentClaimed?: number | string;
      };
      isBuyBoxWinner?: boolean;
      merchantInfo?: {
        id?: string;
        name?: string;
      };
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
    }>;
  };
};

type AmazonSearchResponse = {
  searchResult?: {
    items?: AmazonSearchItem[];
    totalResultCount?: number;
  };
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

function envObrigatoria(nome: string) {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    throw new Error(`Variavel ${nome} nao configurada.`);
  }
  return valor;
}

export function amazonCreatorsConfigurado() {
  return Boolean(
    process.env.AMAZON_CREATORS_CLIENT_ID?.trim() &&
      process.env.AMAZON_CREATORS_CLIENT_SECRET?.trim() &&
      process.env.AMAZON_CREATORS_CREDENTIAL_VERSION?.trim() &&
      process.env.AMAZON_ASSOCIATE_TAG?.trim()
  );
}

export function obterAmazonCreatorsConfig(): AmazonCreatorsConfig {
  return {
    clientId: envObrigatoria("AMAZON_CREATORS_CLIENT_ID"),
    clientSecret: envObrigatoria("AMAZON_CREATORS_CLIENT_SECRET"),
    credentialVersion: envObrigatoria("AMAZON_CREATORS_CREDENTIAL_VERSION"),
    partnerTag: envObrigatoria("AMAZON_ASSOCIATE_TAG"),
    marketplace: AMAZON_MARKETPLACE_BR,
  };
}

function endpointToken(credentialVersion: string) {
  const versao = credentialVersion.trim();

  if (versao === "3.1") {
    return "https://api.amazon.com/auth/o2/token";
  }

  if (versao === "3.2") {
    return "https://api.amazon.co.uk/auth/o2/token";
  }

  if (versao === "3.3") {
    return "https://api.amazon.co.jp/auth/o2/token";
  }

  throw new Error(
    `Versao de credencial Amazon Creators nao suportada: ${credentialVersion}.`
  );
}

async function obterAccessToken(config: AmazonCreatorsConfig) {
  const agora = Date.now();

  if (tokenCache && tokenCache.expiresAt > agora + 60_000) {
    return tokenCache.accessToken;
  }

  const resposta = await fetch(endpointToken(config.credentialVersion), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "creatorsapi::default",
    }),
    cache: "no-store",
  });

  const dados = (await resposta.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      }
    | null;

  if (!resposta.ok || !dados?.access_token) {
    throw new Error(
      dados?.error_description ||
        dados?.error ||
        `Falha obtendo token Amazon Creators (HTTP ${resposta.status}).`
    );
  }

  const expiresIn = Number(dados.expires_in || 3600);
  tokenCache = {
    accessToken: dados.access_token,
    expiresAt: agora + Math.max(300, expiresIn) * 1000,
  };

  return tokenCache.accessToken;
}

async function chamarCreatorsApi<T>(
  caminho: string,
  corpo: Record<string, unknown>
): Promise<T> {
  const config = obterAmazonCreatorsConfig();
  const token = await obterAccessToken(config);

  const resposta = await fetch(`${AMAZON_API_BASE}${caminho}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-marketplace": config.marketplace,
    },
    body: JSON.stringify({
      ...corpo,
      marketplace: config.marketplace,
      partnerTag: config.partnerTag,
    }),
    cache: "no-store",
  });

  const dados = (await resposta.json().catch(() => null)) as T | null;

  if (!resposta.ok || !dados) {
    throw new Error(`Amazon Creators respondeu HTTP ${resposta.status}.`);
  }

  return dados;
}

export async function pesquisarItensAmazon({
  keywords,
  searchIndex = "All",
  itemCount = 10,
  minSavingPercent,
}: {
  keywords: string;
  searchIndex?: string;
  itemCount?: number;
  minSavingPercent?: number;
}) {
  const termo = keywords.trim();
  if (!termo) {
    throw new Error("Informe keywords para pesquisar na Amazon.");
  }

  const quantidade = Math.max(1, Math.min(10, Math.trunc(itemCount || 10)));

  const corpo: Record<string, unknown> = {
    keywords: termo,
    searchIndex,
    itemCount: quantidade,
    resources: [
      "images.primary.medium",
      "itemInfo.title",
      "offersV2.listings.availability",
      "offersV2.listings.dealDetails",
      "offersV2.listings.isBuyBoxWinner",
      "offersV2.listings.merchantInfo",
      "offersV2.listings.price",
      "offersV2.listings.type",
    ],
  };

  if (
    Number.isFinite(minSavingPercent) &&
    Number(minSavingPercent) > 0 &&
    Number(minSavingPercent) < 100
  ) {
    corpo.minSavingPercent = Math.trunc(Number(minSavingPercent));
  }

  const retorno = await chamarCreatorsApi<AmazonSearchResponse>(
    "/catalog/v1/searchItems",
    corpo
  );

  if (retorno.errors?.length) {
    const mensagem = retorno.errors
      .map((erro) => erro.message || erro.code)
      .filter(Boolean)
      .join(" | ");

    throw new Error(mensagem || "Amazon Creators retornou erro na pesquisa.");
  }

  return {
    marketplace: AMAZON_MARKETPLACE_BR,
    items: retorno.searchResult?.items || [],
    totalResultCount: retorno.searchResult?.totalResultCount ?? null,
  };
}
