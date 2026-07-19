import type { Page } from "playwright";
import { getBrowser } from "@/lib/playwright";
import { buscarProdutoMercadoLivre } from "@/lib/services/mercadoLivreApi";
import { resolverItemId } from "@/lib/resolvers/mercadoLivre";

type ProdutoExtraido = {
  nome: string;
  categoria: string;
  loja: string;
  precoAntigo: string;
  precoAtual: string;
  imagem: string;
};

type OfertaJsonLd = {
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
};

type ProdutoJsonLd = {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[];
  category?: string;
  offers?: OfertaJsonLd | OfertaJsonLd[];
};

function limparTexto(valor?: string | null): string {
  return valor?.replace(/\s+/g, " ").trim() || "";
}

function normalizarPreco(
  valor?: string | number | null
): string {
  if (valor === null || valor === undefined) {
    return "";
  }

  let texto = String(valor)
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!texto) {
    return "";
  }

  const possuiPonto = texto.includes(".");
  const possuiVirgula = texto.includes(",");

  // Exemplo brasileiro: 2.499,90
  if (possuiPonto && possuiVirgula) {
    texto = texto
      .replace(/\./g, "")
      .replace(",", ".");

    return texto;
  }

  // Exemplo brasileiro sem milhar: 2499,90
  if (possuiVirgula) {
    return texto.replace(",", ".");
  }

  // Exemplo JSON-LD: 2499.90
  return texto;
}

function decodificarUrl(valor: string): string {
  let resultado = valor
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"');

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    try {
      const decodificado = decodeURIComponent(resultado);

      if (decodificado === resultado) {
        break;
      }

      resultado = decodificado;
    } catch {
      break;
    }
  }

  return resultado;
}

function ehUrlProdutoMercadoLivre(valor: string): boolean {
  try {
    const url = new URL(decodificarUrl(valor));

    const host = url.hostname.toLowerCase();
    const caminho = url.pathname.toLowerCase();

    const dominioValido =
      host === "produto.mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolivre.com.br";

    if (!dominioValido) {
      return false;
    }

    if (
      caminho.includes("/social/") ||
      caminho.includes("/gz/account-verification")
    ) {
      return false;
    }

    return (
      /\/mlb-\d+/i.test(caminho) ||
      /\/p\/mlb\d+/i.test(caminho)
    );
  } catch {
    return false;
  }
}

function localizarUrlProduto(
  valores: Iterable<string>
): string {
  for (const valorOriginal of valores) {
    if (!valorOriginal) {
      continue;
    }

    const valor = decodificarUrl(valorOriginal);

    if (ehUrlProdutoMercadoLivre(valor)) {
      return valor;
    }

    const urlsEncontradas =
      valor.match(/https?:\/\/[^\s"'<>\\]+/gi) || [];

    for (const urlEncontrada of urlsEncontradas) {
      const urlLimpa = decodificarUrl(urlEncontrada);

      if (ehUrlProdutoMercadoLivre(urlLimpa)) {
        return urlLimpa;
      }
    }
  }

  return "";
}

async function coletarUrlsDaPagina(
  page: Page
): Promise<string[]> {
  const urls: string[] = [page.url()];

  const metadados = [
    {
      seletor: 'link[rel="canonical"]',
      atributo: "href",
    },
    {
      seletor: 'meta[property="og:url"]',
      atributo: "content",
    },
    {
      seletor: 'meta[name="twitter:url"]',
      atributo: "content",
    },
    {
      seletor: 'meta[http-equiv="refresh"]',
      atributo: "content",
    },
  ];

  for (const item of metadados) {
    const valor = await page
      .locator(item.seletor)
      .first()
      .getAttribute(item.atributo)
      .catch(() => null);

    if (valor) {
      urls.push(valor);
    }
  }

  const links = await page
    .locator("a[href]")
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => {
          const link = elemento as HTMLAnchorElement;
          return link.href || link.getAttribute("href") || "";
        })
        .filter(Boolean)
    )
    .catch(() => []);

  urls.push(...links);

  const html = await page.content().catch(() => "");

  if (html) {
    urls.push(html);
  }

  return urls;
}

async function abrirPagina(
  page: Page,
  url: string
): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });

  await page.waitForTimeout(2500);
}

async function tratarVerificacao(
  page: Page
): Promise<void> {
  const urlAtual = page.url();

  if (urlAtual.includes("/captcha/")) {
    console.log(
      "CAPTCHA detectado. Resolva a verificação na janela aberta."
    );

    await page.waitForURL(
      (url) => !url.toString().includes("/captcha/"),
      {
        timeout: 120000,
      }
    );

    await page.waitForTimeout(2500);
    return;
  }

  if (!urlAtual.includes("/gz/account-verification")) {
    return;
  }

  const urlDestino = new URL(urlAtual).searchParams.get("go");

  if (!urlDestino) {
    throw new Error(
      "O Mercado Livre bloqueou o acesso com uma verificação de segurança."
    );
  }

  await abrirPagina(page, decodificarUrl(urlDestino));

  if (page.url().includes("/gz/account-verification")) {
    throw new Error(
      "O Mercado Livre manteve a verificação de segurança e não liberou o anúncio."
    );
  }
}

async function tentarBotaoIntermediario(
  page: Page
): Promise<string> {
  const elementos = page.locator(
    [
      'a[href*="/MLB-"]',
      'a[href*="/p/MLB"]',
      'a:has-text("Ver produto")',
      'a:has-text("Ir para o produto")',
      'a:has-text("Acessar oferta")',
      'a:has-text("Comprar")',
      'button:has-text("Continuar")',
      'button:has-text("Ver produto")',
    ].join(", ")
  );

  const quantidade = await elementos.count().catch(() => 0);

  for (let indice = 0; indice < quantidade; indice += 1) {
    const elemento = elementos.nth(indice);

    if (!(await elemento.isVisible().catch(() => false))) {
      continue;
    }

    const href = await elemento
      .getAttribute("href")
      .catch(() => null);

    if (href) {
      const urlResolvida = new URL(
        href,
        page.url()
      ).toString();

      if (ehUrlProdutoMercadoLivre(urlResolvida)) {
        return urlResolvida;
      }
    }

    const urlAntes = page.url();

    await elemento
      .click({
        timeout: 5000,
      })
      .catch(() => undefined);

    await page.waitForTimeout(2500);

    if (
      page.url() !== urlAntes &&
      ehUrlProdutoMercadoLivre(page.url())
    ) {
      return page.url();
    }
  }

  return "";
}

async function resolverLinkProduto(
  page: Page,
  linkOriginal: string
): Promise<string> {
  const urlsObservadas = new Set<string>();

  const registrarUrl = (url: string) => {
    if (url) {
      urlsObservadas.add(url);
    }
  };

  page.on("request", (request) => {
    registrarUrl(request.url());
  });

  page.on("response", (response) => {
    registrarUrl(response.url());
  });

  await abrirPagina(page, linkOriginal);

  await tratarVerificacao(page);

  if (ehUrlProdutoMercadoLivre(page.url())) {
    return page.url();
  }

  await page
    .waitForURL(
      (url) => ehUrlProdutoMercadoLivre(url.toString()),
      {
        timeout: 5000,
      }
    )
    .catch(() => undefined);

  if (ehUrlProdutoMercadoLivre(page.url())) {
    return page.url();
  }

  const urlsDaPagina = await coletarUrlsDaPagina(page);

  const urlEncontrada = localizarUrlProduto([
    ...urlsDaPagina,
    ...urlsObservadas,
  ]);

  if (urlEncontrada) {
    return urlEncontrada;
  }

  const urlDoBotao = await tentarBotaoIntermediario(page);

  if (urlDoBotao) {
    return urlDoBotao;
  }

  const titulo = await page.title().catch(() => "");

  throw new Error(
    [
      "Não foi possível descobrir o endereço real do produto.",
      `Página final: ${page.url()}`,
      titulo ? `Título: ${titulo}` : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function ehProdutoJsonLd(
  item: unknown
): item is ProdutoJsonLd {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const tipo = (item as ProdutoJsonLd)["@type"];

  if (Array.isArray(tipo)) {
    return tipo.includes("Product");
  }

  return tipo === "Product";
}

function procurarProdutoJsonLd(
  conteudo: unknown
): ProdutoJsonLd | null {
  if (ehProdutoJsonLd(conteudo)) {
    return conteudo;
  }

  if (Array.isArray(conteudo)) {
    for (const item of conteudo) {
      const encontrado = procurarProdutoJsonLd(item);

      if (encontrado) {
        return encontrado;
      }
    }

    return null;
  }

  if (typeof conteudo === "object" && conteudo !== null) {
    const objeto = conteudo as Record<string, unknown>;

    if (objeto["@graph"]) {
      return procurarProdutoJsonLd(objeto["@graph"]);
    }
  }

  return null;
}

async function extrairJsonLd(
  page: Page
): Promise<ProdutoJsonLd | null> {
  const blocos = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents()
    .catch(() => []);

  for (const bloco of blocos) {
    try {
      const conteudo = JSON.parse(bloco);
      const produto = procurarProdutoJsonLd(conteudo);

      if (produto) {
        return produto;
      }
    } catch {
      // Ignora blocos JSON-LD inválidos.
    }
  }

  return null;
}

async function obterTexto(
  page: Page,
  seletor: string
): Promise<string> {
  return limparTexto(
    await page
      .locator(seletor)
      .first()
      .textContent()
      .catch(() => "")
  );
}

async function obterAtributo(
  page: Page,
  seletor: string,
  atributo: string
): Promise<string> {
  return (
    (await page
      .locator(seletor)
      .first()
      .getAttribute(atributo)
      .catch(() => "")) || ""
  );
}

async function extrairValorMonetario(
  page: Page,
  seletorBase: string
): Promise<string> {
  const inteiro = await obterTexto(
    page,
    `${seletorBase} .andes-money-amount__fraction`
  );

  const centavos = await obterTexto(
    page,
    `${seletorBase} .andes-money-amount__cents`
  );

  if (!inteiro) {
    return "";
  }

  return normalizarPreco(
    centavos ? `${inteiro},${centavos}` : inteiro
  );
}

function obterOferta(
  produto: ProdutoJsonLd | null
): OfertaJsonLd | null {
  if (!produto?.offers) {
    return null;
  }

  if (Array.isArray(produto.offers)) {
    return produto.offers[0] || null;
  }

  return produto.offers;
}

function converterCategoriaInterna(
  categoriaOriginal: string,
  nomeProduto: string
): string {
  const texto = `${categoriaOriginal} ${nomeProduto}`.toLowerCase();

  if (
    /celular|smartphone|notebook|computador|tablet|televis|tv|fone|headset|eletrôn|eletron|tecnologia|gamer/.test(
      texto
    )
  ) {
    return "Tecnologia";
  }

  if (
    /carro|moto|automot|pneu|veículo|veiculo/.test(texto)
  ) {
    return "Automotivo";
  }

  if (
    /ferramenta|furadeira|parafusadeira|serra|chave|alicate/.test(
      texto
    )
  ) {
    return "Ferramentas";
  }

  if (
    /bebê|bebe|criança|crianca|brinquedo|infantil|fralda/.test(
      texto
    )
  ) {
    return "Infantil";
  }

  if (
    /roupa|calçado|calcado|tênis|tenis|camisa|vestido|moda/.test(
      texto
    )
  ) {
    return "Moda";
  }

  if (
    /casa|cozinha|móvel|movel|eletrodomést|eletrodomest|decoração|decoracao/.test(
      texto
    )
  ) {
    return "Casa e Cozinha";
  }

  return "";
}

export async function extrairMercadoLivre(
  link: string
): Promise<ProdutoExtraido> {
 const itemId = await resolverItemId(link);
console.log("LINK RECEBIDO:", link);
console.log("ITEM ID RESOLVIDO:", itemId);
  if (itemId) {
    try {
      console.log(
        `Tentando buscar ${itemId} pela API do Mercado Livre.`
      );

      const produtoApi =
        await buscarProdutoMercadoLivre(itemId);

      const nome = limparTexto(produtoApi.title);

      const precoAtual = normalizarPreco(
        produtoApi.price
      );

      let precoAntigo = normalizarPreco(
        produtoApi.original_price
      );

      if (
        precoAntigo &&
        precoAtual &&
        Number(precoAntigo) <= Number(precoAtual)
      ) {
        precoAntigo = "";
      }

      const categoria = converterCategoriaInterna(
        produtoApi.category_id,
        nome
      );

      if (!nome || !precoAtual) {
        throw new Error(
          "A API não retornou nome ou preço do produto."
        );
      }

      console.log("PRODUTO EXTRAÍDO PELA API:", {
        itemId,
        nome,
        categoria,
        precoAntigo,
        precoAtual,
        imagem: produtoApi.thumbnail,
      });

      return {
        nome,
        categoria,
        loja: "Mercado Livre",
        precoAntigo,
        precoAtual,
        imagem: produtoApi.thumbnail || "",
      };
        } catch (erro) {
      console.error(
        "A API do Mercado Livre falhou:",
        erro
      );

      throw erro;
    }
  }

  const browser = await getBrowser();

  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: {
      width: 1440,
      height: 1000,
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/142.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });

  const page = await context.newPage();

  try {
    const urlProduto = await resolverLinkProduto(page, link);

    if (page.url() !== urlProduto) {
      await abrirPagina(page, urlProduto);
    }

    await tratarVerificacao(page);

    await page
      .locator(
        'h1.ui-pdp-title, script[type="application/ld+json"]'
      )
      .first()
      .waitFor({
        state: "attached",
        timeout: 10000,
      })
      .catch(() => undefined);

    const jsonLd = await extrairJsonLd(page);
    const oferta = obterOferta(jsonLd);

    const nome =
      limparTexto(jsonLd?.name) ||
      (await obterTexto(page, "h1.ui-pdp-title")) ||
      limparTexto(
        await obterAtributo(
          page,
          'meta[property="og:title"]',
          "content"
        )
      );

    const precoAtual =
      normalizarPreco(oferta?.price) ||
      normalizarPreco(oferta?.lowPrice) ||
      (await extrairValorMonetario(
        page,
        ".ui-pdp-price__second-line"
      ));

    let precoAntigo =
      normalizarPreco(oferta?.highPrice) ||
      (await extrairValorMonetario(
        page,
        ".ui-pdp-price__original-value"
      ));

    if (
      precoAntigo &&
      precoAtual &&
      Number(precoAntigo) <= Number(precoAtual)
    ) {
      precoAntigo = "";
    }

    const imagemJsonLd = Array.isArray(jsonLd?.image)
      ? jsonLd.image[0]
      : jsonLd?.image;

    const imagem =
      limparTexto(imagemJsonLd) ||
      limparTexto(
        await obterAtributo(
          page,
          'meta[property="og:image"]',
          "content"
        )
      ) ||
      limparTexto(
        await obterAtributo(
          page,
          ".ui-pdp-gallery__figure img",
          "src"
        )
      ) ||
      limparTexto(
        await obterAtributo(
          page,
          ".ui-pdp-gallery__figure img",
          "data-zoom"
        )
      );

    const breadcrumbs = await page
      .locator(".andes-breadcrumb__link")
      .allTextContents()
      .catch(() => []);

    const categoriaOriginal =
      limparTexto(jsonLd?.category) ||
      limparTexto(breadcrumbs.join(" "));

    const categoria = converterCategoriaInterna(
      categoriaOriginal,
      nome
    );

    if (!nome) {
      throw new Error(
        `A página foi aberta, mas o nome do produto não foi encontrado. URL final: ${page.url()}`
      );
    }

    if (!precoAtual) {
      throw new Error(
        `O produto foi identificado, mas o preço atual não foi encontrado. URL final: ${page.url()}`
      );
    }

    console.log("PRODUTO EXTRAÍDO:", {
      urlFinal: page.url(),
      nome,
      categoria,
      precoAntigo,
      precoAtual,
      imagem,
    });

    return {
      nome,
      categoria,
      loja: "Mercado Livre",
      precoAntigo,
      precoAtual,
      imagem,
    };
  } finally {
    await context.close();
  }
}