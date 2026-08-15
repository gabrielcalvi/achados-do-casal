const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const destino = path.join(process.cwd(), "tmp", "meli-buyer-auth.json");
const perfil = path.join(process.cwd(), "tmp", "meli-buyer-profile");
const urlCupons = "https://www.mercadolivre.com.br/cupons/filter?all=true&source_page=int_view_all";

function aguardarEnter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\nDepois de confirmar que a pagina de cupons abriu LOGADA, pressione ENTER aqui... ",
      () => {
        rl.close();
        resolve();
      }
    );
  });
}

(async () => {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.mkdirSync(perfil, { recursive: true });

  console.log("Abrindo Mercado Livre em Chrome visivel...");
  console.log("Faça login normalmente se o Mercado Livre solicitar.");
  console.log("Quando estiver na pagina de cupons, volte a este terminal.");

  const contexto = await chromium.launchPersistentContext(perfil, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  });

  let pagina = contexto.pages()[0];
  if (!pagina) {
    pagina = await contexto.newPage();
  }

  await pagina.goto(urlCupons, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await pagina.bringToFront();
  await aguardarEnter();

  const urlAtual = pagina.url();

  if (!urlAtual.includes("mercadolivre.com.br/cupons")) {
    throw new Error(
      `A pagina ainda nao esta autenticada na area de cupons. URL atual: ${urlAtual}`
    );
  }

  await contexto.storageState({ path: destino });

  const stat = fs.statSync(destino);
  if (!stat.size) {
    throw new Error("O arquivo de sessao foi criado vazio.");
  }

  console.log("\nSessao renovada com sucesso.");
  console.log(`Arquivo criado em: ${destino}`);
  console.log("Agora envie esse arquivo pela tela Admin > Cupons ML V2.");

  await contexto.close();
})().catch(async (erro) => {
  console.error("\nERRO:", erro.message);
  process.exitCode = 1;
});
