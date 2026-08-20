const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const AUTH_FILE =
  process.env.MELI_AFFILIATE_AUTH_STATE_PATH?.trim() ||
  path.join(process.cwd(), "tmp", "meli-auth.json");

const RESULT_PATH =
  process.env.ML_V2_COMISSOES_RESULT_PATH?.trim() ||
  path.join(process.cwd(), "tmp", "ml-v2-comissoes.json");

const CONCORRENCIA = Math.max(
  1,
  Math.min(4, Number(process.env.ML_V2_COMISSOES_CONCURRENCY || 3) || 3)
);

function normalizarItemId(valor) {
  const itemId = String(valor || "").trim().toUpperCase();
  return /^MLB\d+$/.test(itemId) ? itemId : null;
}

function urlProduto(itemId) {
  return `https://produto.mercadolivre.com.br/MLB-${itemId.slice(3)}`;
}

function percentualDaBarra(texto) {
  const normalizado = String(texto || "").replace(/\s+/g, " ");
  const match = normalizado.match(
    /GANHOS?\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i
  );

  if (!match) return null;

  const valor = Number(match[1].replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

async function verificarItem(context, itemId) {
  const page = await context.newPage();
  const verificadaEm = new Date().toISOString();

  try {
    await page.goto(urlProduto(itemId), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(800);
    await page
      .waitForFunction(() => /GANHOS/i.test(document.body?.innerText || ""), null, {
        timeout: 6000,
      })
      .catch(() => undefined);

    if (
      page.url().includes("/gz/account-verification") ||
      page.url().includes("/captcha/") ||
      page.url().includes("/login")
    ) {
      throw new Error("Sessao afiliada requer nova autenticacao.");
    }

    const texto = await page
      .locator("body")
      .innerText({ timeout: 10000 })
      .catch(() => "");

    const percentual = percentualDaBarra(texto);

    return {
      item_id: itemId,
      percentual,
      status: percentual === null ? "nao_identificada" : "verificada",
      url_final: page.url(),
      verificada_em: verificadaEm,
    };
  } catch (erro) {
    return {
      item_id: itemId,
      percentual: null,
      status: "erro",
      erro: erro instanceof Error ? erro.message : String(erro),
      url_final: page.url() || urlProduto(itemId),
      verificada_em: verificadaEm,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

(async () => {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error(`Sessao afiliada nao encontrada: ${AUTH_FILE}`);
  }

  let recebidos;

  try {
    recebidos = JSON.parse(process.env.ML_V2_ITEM_IDS || "[]");
  } catch {
    throw new Error("ML_V2_ITEM_IDS possui JSON invalido.");
  }

  const itemIds = [
    ...new Set(
      (Array.isArray(recebidos) ? recebidos : [])
        .map(normalizarItemId)
        .filter(Boolean)
    ),
  ];

  if (itemIds.length === 0) {
    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(
      RESULT_PATH,
      JSON.stringify({ sucesso: true, resultados: [] }, null, 2),
      "utf8"
    );
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1400, height: 900 },
    locale: "pt-BR",
  });

  try {
    const resultados = new Array(itemIds.length);
    let indice = 0;

    async function consumidor() {
      while (true) {
        const atual = indice;
        indice += 1;

        if (atual >= itemIds.length) return;

        resultados[atual] = await verificarItem(context, itemIds[atual]);
      }
    }

    const quantidadeConsumidores = Math.min(CONCORRENCIA, itemIds.length);

    await Promise.all(
      Array.from({ length: quantidadeConsumidores }, () => consumidor())
    );

    fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
    fs.writeFileSync(
      RESULT_PATH,
      JSON.stringify(
        {
          sucesso: true,
          total: resultados.length,
          verificados: resultados.filter((item) => item.status === "verificada")
            .length,
          zerados: resultados.filter((item) => item.percentual === 0).length,
          resultados,
        },
        null,
        2
      ),
      "utf8"
    );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
})().catch((erro) => {
  console.error("ERRO:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
