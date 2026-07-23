const http = require("http");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const PORTA = Number(
  process.env.PORT ||
  process.env.PLAYWRIGHT_WORKER_PORT ||
  4317
);

const userDataDir = path.join(
  process.cwd(),
  ".playwright-profile"
);

let context = null;
let workerPage = null;
let inicializacao = null;

async function obterContexto() {
  const browser = context?.browser();

  if (context && browser?.isConnected()) {
    return context;
  }

  context = null;

  if (inicializacao) {
    return inicializacao;
  }

  inicializacao = (async () => {
    fs.mkdirSync(userDataDir, {
      recursive: true,
    });


const novoContexto =
  await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.PLAYWRIGHT_HEADLESS === "true",
    slowMo: 100,
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

novoContexto.on("close", () => {
  console.log("Contexto do Playwright fechado.");

  if (context === novoContexto) {
    context = null;
  }
});

context = novoContexto;

    return context;
  })();

  try {
    return await inicializacao;
  } finally {
    inicializacao = null;
  }
}

function responderJson(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });

  res.end(JSON.stringify(dados));
}

function limparTexto(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarPreco(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  let texto = String(valor)
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!texto) {
    return "";
  }

  if (texto.includes(".") && texto.includes(",")) {
    return texto
      .replace(/\./g, "")
      .replace(",", ".");
  }

  if (texto.includes(",")) {
    return texto.replace(",", ".");
  }

  return texto;
}

function ehProdutoJsonLd(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const tipo = item["@type"];

  if (Array.isArray(tipo)) {
    return tipo.includes("Product");
  }

  return tipo === "Product";
}

function procurarProdutoJsonLd(conteudo) {
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

  if (conteudo && typeof conteudo === "object") {
    if (conteudo["@graph"]) {
      return procurarProdutoJsonLd(conteudo["@graph"]);
    }
  }

  return null;
}

async function extrairJsonLd(page) {
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
      // Ignora blocos inválidos.
    }
  }

  return null;
}

async function obterTexto(page, seletor) {
  return limparTexto(
    await page
      .locator(seletor)
      .first()
      .textContent()
      .catch(() => "")
  );
}

async function obterAtributo(page, seletor, atributo) {
  return (
    (await page
      .locator(seletor)
      .first()
      .getAttribute(atributo)
      .catch(() => "")) || ""
  );
}

async function extrairValorMonetario(page, seletorBase) {
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

async function extrairProduto(urlProduto) {
  const contexto = await obterContexto();
if (!workerPage || workerPage.isClosed()) {
  workerPage = await contexto.newPage();
}

const page = workerPage;
await page.bringToFront();
  console.log("[WORKER] Nova aba criada");

  try {
    console.log("Extraindo produto:", urlProduto);
      console.log("[WORKER] Iniciando page.goto()");


    await page.goto(urlProduto, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("[WORKER] page.goto() concluído");

    await page
      .locator(
        'h1.ui-pdp-title, script[type="application/ld+json"]'
      )
      .first()
      .waitFor({
        state: "attached",
        timeout: 15000,
      })
      .catch(() => undefined);

    if (
      page.url().includes("/gz/account-verification") ||
      page.url().includes("/captcha/")
    ) {
      throw new Error(
        "O Mercado Livre solicitou uma nova verificação de segurança."
      );
    }

    const jsonLd = await extrairJsonLd(page);
console.log("[WORKER] JSON-LD carregado");
    const oferta = Array.isArray(jsonLd?.offers)
      ? jsonLd.offers[0]
      : jsonLd?.offers || null;

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
const urlsGaleria = [
  ...(Array.isArray(jsonLd?.image)
    ? jsonLd.image
    : jsonLd?.image
      ? [jsonLd.image]
      : []),

  ...(await page
    .locator(".ui-pdp-gallery__figure img")
    .evaluateAll((imagens) =>
      imagens.flatMap((imagem) => [
        imagem.getAttribute("data-zoom"),
        imagem.getAttribute("src"),
      ])
    )
    .catch(() => [])),
]
  .map((url) => limparTexto(url))
  .filter((url) => url && url.startsWith("http"));

const imagensUnicas = new Map();

for (const url of urlsGaleria) {
  const identificadorMercadoLivre =
    url.match(/ML[A-Z]\d+_\d+/i)?.[0] || url;

  if (!imagensUnicas.has(identificadorMercadoLivre)) {
    imagensUnicas.set(identificadorMercadoLivre, url);
  }
}

const imagensGaleria = Array.from(imagensUnicas.values());
const avaliacaoTexto =
  limparTexto(
    await page
      .locator(".ui-pdp-review__rating")
      .first()
      .textContent()
      .catch(() => "")
  ) || "";

const avaliacao = Number(
  avaliacaoTexto.replace(",", ".")
) || null;   
const breadcrumbs = await page

      .locator(".andes-breadcrumb__link")
      .allTextContents()
      .catch(() => []);

    const categoria =
      limparTexto(jsonLd?.category) ||
      limparTexto(breadcrumbs.join(" > "));

    if (!nome) {
      throw new Error(
        `Nome do produto não encontrado. URL final: ${page.url()}`
      );
    }
const vendas =
  limparTexto(
    await page
      .locator(".ui-pdp-subtitle")
      .first()
      .textContent()
      .catch(() => "")
  )
    .split("|")
    .find((parte) => /vendidos?/i.test(parte))
    ?.trim() || "";
    if (!precoAtual) {
      throw new Error(
        `Preço do produto não encontrado. URL final: ${page.url()}`
      );
    }
const textoPagina = (
  await page.evaluate(() => document.body.innerText)
).replace(/\s+/g, " ");

const parcelasBrutas =
  limparTexto(
    await page
      .locator("text=/\\d+x\\s*R\\$/i")
      .first()
      .innerText()
      .catch(() => "")
  ) || "";

const parcelas =
  parcelasBrutas
    .replace(/\s*([.,])\s*/g, "$1")
    .match(/\b\d+x\s+R\$\s*\d+(?:[.,]\d{2})?(?:\s+sem juros)?/i)?.[0] || "";

const freteGratis =
  (
    await page
      .locator("text=/Frete grátis/i")
      .count()
  ) > 0;
  const vendasExtraidas =
  limparTexto(
    await page
      .locator(".ui-pdp-subtitle")
      .first()
      .textContent()
      .catch(() => "")
  )
    .split("|")
    .find((parte) => /vendidos?/i.test(parte))
    ?.trim() || "";
  const dados = {
  nome,
  categoria,
  loja: "Mercado Livre",
  precoAntigo,
  precoAtual,
  parcelas,
  freteGratis,
  imagem,
  imagensGaleria,
  avaliacao,
  vendas: vendasExtraidas,
    urlFinal: page.url(),
}; 

    console.log("Produto extraído:", dados);

    return dados;
  } finally {
     }
}

const servidor = http.createServer(async (req, res) => {
  try {
    const urlRequisicao = new URL(
      req.url,
      `http://127.0.0.1:${PORTA}`
    );

    if (
      req.method === "GET" &&
      urlRequisicao.pathname === "/health"
    ) {
      const navegadorConectado =
        Boolean(context?.browser()?.isConnected());

      return responderJson(res, 200, {
        sucesso: true,
        servico: "playwright-worker",
        navegadorConectado,
      });
    }

    if (
      req.method === "GET" &&
      urlRequisicao.pathname === "/login"
    ) {
      const contexto = await obterContexto();
await contexto.newPage();
      let page = contexto.pages().find(
        (pagina) =>
          pagina.url().includes("mercadolivre.com.br")
      );

      if (!page) {
        page = await contexto.newPage();
      }

      await page.goto("https://www.mercadolivre.com.br", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page.bringToFront();

      return responderJson(res, 200, {
        sucesso: true,
        mensagem:
          "Navegador aberto e sessão disponível.",
      });
    }

    if (
      req.method === "GET" &&
      urlRequisicao.pathname === "/extrair"
    ) {
      const urlProduto =
        urlRequisicao.searchParams.get("url");

      if (!urlProduto) {
        return responderJson(res, 400, {
          sucesso: false,
          erro: "Informe o parâmetro url.",
        });
      }

      try {
        new URL(urlProduto);
      } catch {
        return responderJson(res, 400, {
          sucesso: false,
          erro: "A URL informada não é válida.",
        });
      }

      const dados = await extrairProduto(urlProduto);

      return responderJson(res, 200, {
        sucesso: true,
        dados,
      });
    }

    return responderJson(res, 404, {
      sucesso: false,
      erro: "Rota não encontrada.",
    });
  } catch (erro) {
    console.error("ERRO NO WORKER:", erro);

    return responderJson(res, 500, {
      sucesso: false,
      erro:
        erro instanceof Error
          ? erro.message
          : "Erro desconhecido no Playwright Worker.",
    });
  }
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log("");
  console.log("Playwright Worker iniciado.");
  console.log(`Health:  http://127.0.0.1:${PORTA}/health`);
  console.log(`Login:   http://127.0.0.1:${PORTA}/login`);
  console.log(`Extrair: http://127.0.0.1:${PORTA}/extrair?url=...`);
  console.log("");
});

async function encerrar() {
  console.log("\nEncerrando Playwright Worker...");

  if (context) {
    // await context.close().catch(() => undefined);
  }

  servidor.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);