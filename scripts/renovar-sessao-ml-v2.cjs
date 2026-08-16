const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const raiz = process.cwd();
const destino = path.join(raiz, "tmp", "meli-buyer-auth.json");
const perfil = path.join(raiz, "tmp", "meli-buyer-profile");
const envLocal = path.join(raiz, ".env.local");
const urlCupons = "https://www.mercadolivre.com.br/cupons/filter?all=true&source_page=int_view_all";
const baseUrl = "https://achadosdocasal.com.br";

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

function carregarEnvLocal() {
  if (!fs.existsSync(envLocal)) {
    return;
  }

  const linhas = fs.readFileSync(envLocal, "utf8").split(/\r?\n/);

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();

    if (!linha || linha.startsWith("#")) {
      continue;
    }

    const indice = linha.indexOf("=");
    if (indice <= 0) {
      continue;
    }

    const chave = linha.slice(0, indice).trim();
    let valor = linha.slice(indice + 1).trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (chave && !(chave in process.env)) {
      process.env[chave] = valor;
    }
  }
}

async function enviarSessaoAoSandbox(segredo) {
  const conteudo = fs.readFileSync(destino);
  const formData = new FormData();
  formData.append(
    "arquivo",
    new Blob([conteudo], { type: "application/json" }),
    "meli-buyer-auth.json"
  );

  const resposta = await fetch(
    `${baseUrl}/api/admin/economize/cupons/ml-v2/sessao`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${segredo}`,
      },
      body: formData,
    }
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(
      dados.erro || `Falha ao enviar sessao ao Sandbox (HTTP ${resposta.status}).`
    );
  }

  console.log("Sessao enviada ao Sandbox com sucesso.");
}

async function executarColeta(segredo) {
  console.log("Iniciando coleta ML V2 em producao...");

  const resposta = await fetch(
    `${baseUrl}/api/admin/economize/cupons/ml-v2/executar`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${segredo}`,
      },
      cache: "no-store",
    }
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(
      dados.erro || `Falha na coleta ML V2 (HTTP ${resposta.status}).`
    );
  }

  console.log("\nColeta ML V2 concluida com sucesso.");
  console.log(`Paginas lidas: ${dados.total_paginas_lidas ?? 0}`);
  console.log(`Cupons validos encontrados: ${dados.total_encontrados ?? 0}`);
}

(async () => {
  carregarEnvLocal();

  const segredo = String(process.env.CRON_SECRET || "").trim();

  if (!segredo) {
    throw new Error(
      "CRON_SECRET nao foi encontrado no .env.local. O arquivo de sessao sera gerado, mas o envio automatico nao pode continuar."
    );
  }

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.mkdirSync(perfil, { recursive: true });

  console.log("Abrindo Mercado Livre em Chrome visivel...");
  console.log("Faca login normalmente se o Mercado Livre solicitar.");
  console.log("Quando estiver na pagina de cupons, volte a este terminal.");

  const contexto = await chromium.launchPersistentContext(perfil, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  });

  let pagina = contexto.pages()[0];
  if (!pagina) {
    pagina = await contexto.newPage();
  }

  try {
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

    console.log("\nSessao renovada localmente com sucesso.");
    console.log(`Arquivo criado em: ${destino}`);
  } finally {
    await contexto.close();
  }

  await enviarSessaoAoSandbox(segredo);
  await executarColeta(segredo);
})().catch((erro) => {
  console.error("\nERRO:", erro.message);
  process.exitCode = 1;
});
