export type StatusIntegracaoCj = {
  prontaParaAutenticar: boolean;
  prontaParaCatalogo: boolean;
  prontaParaLinks: boolean;
  credenciais: {
    token: boolean;
    publisherId: boolean;
    websiteId: boolean;
    promotionalPropertyId: boolean;
  };
  endpoints: {
    productSearch: boolean;
    linkSearch: boolean;
    commissions: boolean;
  };
  faltando: string[];
};

function valorEnv(nome: string) {
  return String(process.env[nome] || "").trim();
}

export function obterStatusIntegracaoCj(): StatusIntegracaoCj {
  const token = Boolean(valorEnv("CJ_PERSONAL_ACCESS_TOKEN"));
  const publisherId = Boolean(valorEnv("CJ_PUBLISHER_ID"));
  const websiteId = Boolean(valorEnv("CJ_WEBSITE_ID"));
  const promotionalPropertyId = Boolean(valorEnv("CJ_PROMOTIONAL_PROPERTY_ID"));
  const productSearch = Boolean(valorEnv("CJ_PRODUCT_SEARCH_URL"));
  const linkSearch = Boolean(valorEnv("CJ_LINK_SEARCH_URL"));
  const commissions = Boolean(valorEnv("CJ_COMMISSIONS_URL"));

  const faltando: string[] = [];
  if (!token) faltando.push("CJ_PERSONAL_ACCESS_TOKEN");
  if (!publisherId) faltando.push("CJ_PUBLISHER_ID");
  if (!websiteId) faltando.push("CJ_WEBSITE_ID");
  if (!promotionalPropertyId) faltando.push("CJ_PROMOTIONAL_PROPERTY_ID");
  if (!productSearch) faltando.push("CJ_PRODUCT_SEARCH_URL");
  if (!linkSearch) faltando.push("CJ_LINK_SEARCH_URL");

  return {
    prontaParaAutenticar: token && publisherId,
    prontaParaCatalogo: token && publisherId && websiteId && productSearch,
    prontaParaLinks: token && publisherId && websiteId && linkSearch,
    credenciais: {
      token,
      publisherId,
      websiteId,
      promotionalPropertyId,
    },
    endpoints: {
      productSearch,
      linkSearch,
      commissions,
    },
    faltando,
  };
}

export async function requisicaoCj(
  url: string,
  init: RequestInit = {},
) {
  const token = valorEnv("CJ_PERSONAL_ACCESS_TOKEN");
  if (!token) {
    throw new Error("CJ_PERSONAL_ACCESS_TOKEN ainda nao configurado.");
  }

  const resposta = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(
      `CJ respondeu HTTP ${resposta.status}${detalhe ? `: ${detalhe.slice(0, 500)}` : ""}`,
    );
  }

  return resposta;
}

export function configuracaoCj() {
  return {
    publisherId: valorEnv("CJ_PUBLISHER_ID"),
    websiteId: valorEnv("CJ_WEBSITE_ID"),
    promotionalPropertyId: valorEnv("CJ_PROMOTIONAL_PROPERTY_ID"),
    productSearchUrl: valorEnv("CJ_PRODUCT_SEARCH_URL"),
    linkSearchUrl: valorEnv("CJ_LINK_SEARCH_URL"),
    commissionsUrl: valorEnv("CJ_COMMISSIONS_URL") || "https://commissions.api.cj.com/query",
  };
}
