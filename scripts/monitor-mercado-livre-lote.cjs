const fs = require("fs");
const { chromium } = require("playwright");
const { extrairMercadoLivre } = require("./extractors/mercado-livre.cjs");

const entradaPath = String(process.env.MONITOR_ML_INPUT || "").trim();
const saidaPath = String(process.env.MONITOR_ML_OUTPUT || "").trim();
const authStatePath = String(
  process.env.MELI_BUYER_AUTH_STATE_PATH || "/vercel/tmp/meli-buyer-auth.json"
).trim();

function falhar(mensagem) {
  throw new Error(mensagem);
}

(async () => {
  if (!entradaPath || !saidaPath) {
    falhar("Informe MONITOR_ML_INPUT e MONITOR_ML_OUTPUT.");
  }

  if (!fs.existsSync(authStatePath)) {
    falhar(`Sessao buyer nao encontrada: ${authStatePath}`);
  }

  const entrada = JSON.parse(fs.readFileSync(entradaPath, "utf8"));
  const produtos = Array.isArray(entrada?.produtos) ? entrada.produtos.slice(0, 4) : [];

  if (produtos.length === 0) {
    falhar("Nenhum produto foi informado para o lote.");
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: authStatePath,
    locale: "pt-BR",
    viewport: { width: 1440, height: 1000 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/142.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });

  try {
    const resultados = await Promise.all(
      produtos.map(async (produto) => {
        const pagina = await context.newPage();

        try {
          const dados = await extrairMercadoLivre(pagina, produto.url);
          return {
            id: produto.id,
            sucesso: true,
            dados,
          };
        } catch (erro) {
          return {
            id: produto.id,
            sucesso: false,
            erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          };
        } finally {
          await pagina.close().catch(() => undefined);
        }
      })
    );

    fs.writeFileSync(
      saidaPath,
      JSON.stringify({ sucesso: true, resultados }, null, 2),
      "utf8"
    );

    console.log(
      `[MONITOR ML LOTE] ${resultados.filter((item) => item.sucesso).length}/${resultados.length} consultas concluidas.`
    );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
})().catch((erro) => {
  const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido";

  if (saidaPath) {
    try {
      fs.writeFileSync(
        saidaPath,
        JSON.stringify({ sucesso: false, erro: mensagem }, null, 2),
        "utf8"
      );
    } catch {
      // O stderr abaixo continua sendo a fonte principal do erro.
    }
  }

  console.error(`[MONITOR ML LOTE] ${mensagem}`);
  process.exitCode = 1;
});
