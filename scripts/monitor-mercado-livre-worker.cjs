const http = require("http");
const fs = require("fs");
const { chromium } = require("playwright");
const { extrairMercadoLivre } = require("./extractors/mercado-livre.cjs");

const PORTA = Number(process.env.MONITOR_ML_PORT || 4318);
const AUTH_STATE_PATH = String(
  process.env.MELI_BUYER_AUTH_STATE_PATH || "/vercel/tmp/meli-buyer-auth.json"
).trim();

let browser = null;
let context = null;
let inicializacao = null;

function responderJson(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(dados));
}

async function obterContexto() {
  if (context && browser?.isConnected()) {
    return context;
  }

  if (inicializacao) {
    return inicializacao;
  }

  inicializacao = (async () => {
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      throw new Error(
        `Sessao buyer do Mercado Livre nao encontrada: ${AUTH_STATE_PATH}`
      );
    }

    browser = await chromium.launch({
      headless: false,
    });

    context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
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

    console.log(`[MONITOR ML WORKER] Sessao carregada: ${AUTH_STATE_PATH}`);
    return context;
  })();

  try {
    return await inicializacao;
  } finally {
    inicializacao = null;
  }
}

async function extrair(urlProduto) {
  const contexto = await obterContexto();
  const pagina = await contexto.newPage();

  try {
    return await extrairMercadoLivre(pagina, urlProduto);
  } finally {
    await pagina.close().catch(() => undefined);
  }
}

async function encerrar() {
  if (context) {
    await context.close().catch(() => undefined);
    context = null;
  }

  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORTA}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return responderJson(res, 200, {
        sucesso: true,
        servico: "monitor-mercado-livre-worker",
        navegadorConectado: Boolean(browser?.isConnected()),
        authState: AUTH_STATE_PATH,
      });
    }

    if (req.method === "GET" && url.pathname === "/extrair") {
      const urlProduto = url.searchParams.get("url");

      if (!urlProduto) {
        return responderJson(res, 400, {
          sucesso: false,
          erro: "Informe o parametro url.",
        });
      }

      try {
        new URL(urlProduto);
      } catch {
        return responderJson(res, 400, {
          sucesso: false,
          erro: "URL de produto invalida.",
        });
      }

      const dados = await extrair(urlProduto);
      return responderJson(res, 200, {
        sucesso: true,
        dados,
      });
    }

    if (req.method === "POST" && url.pathname === "/shutdown") {
      responderJson(res, 200, { sucesso: true });
      await encerrar();
      servidor.close(() => process.exit(0));
      return;
    }

    return responderJson(res, 404, {
      sucesso: false,
      erro: "Rota nao encontrada.",
    });
  } catch (erro) {
    console.error("[MONITOR ML WORKER] Erro:", erro);
    return responderJson(res, 500, {
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido.",
    });
  }
});

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`[MONITOR ML WORKER] Servidor iniciado em 127.0.0.1:${PORTA}`);
});

process.on("SIGTERM", async () => {
  await encerrar();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await encerrar();
  process.exit(0);
});
