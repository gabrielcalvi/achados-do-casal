const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const { extrairMercadoLivre } = require("./extractors/mercado-livre.cjs");

const BASE_URL = (process.env.ACHADOS_AGENT_URL || "https://achadosdocasal.com.br").replace(/\/$/, "");
const TOKEN = String(process.env.ACHADOS_LOCAL_AGENT_TOKEN || "").trim();
const DEVICE_NAME = process.env.ACHADOS_LOCAL_AGENT_NAME || require("os").hostname();
const PROFILE = path.join(process.cwd(), "tmp", "achados-ml-agent-profile");
const AUTH_FILE = path.join(process.cwd(), "tmp", "meli-buyer-auth.json");
const RESULT_FILE = path.join(process.cwd(), "tmp", "ml-cupons-v2-oficiais.json");
const POLL_MS = Math.max(1000, Number(process.env.ACHADOS_AGENT_POLL_MS || 2500));

if (!TOKEN) {
  console.error("Defina ACHADOS_LOCAL_AGENT_TOKEN no .env.local. Nao cole o token em chats ou GitHub.");
  process.exit(1);
}

let context;
let ocupado = false;
let encerrando = false;

async function request(pathname, options = {}) {
  const response = await fetch(BASE_URL + pathname, {
    ...options,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || `HTTP ${response.status}`);
  return data;
}

async function iniciarNavegador() {
  fs.mkdirSync(PROFILE, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    slowMo: 60,
    locale: "pt-BR",
    viewport: { width: 1440, height: 1000 },
  });
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto("https://www.mercadolivre.com.br", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  }).catch(() => undefined);
  console.log("Chrome local aberto. Faca login no Mercado Livre se for solicitado.");
  console.log("O perfil fica salvo em tmp/achados-ml-agent-profile.");
}

async function executarProduto(url) {
  const page = await context.newPage();
  try {
    const dados = await extrairMercadoLivre(page, url);
    return dados;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function executarCupons() {
  await context.storageState({ path: AUTH_FILE });
  const collector = path.join(process.cwd(), "scripts", "coletar-cupons-oficiais-ml-v2-lote.cjs");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [collector], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MELI_BUYER_AUTH_STATE_PATH: AUTH_FILE,
        ML_V2_MAX_PAGES: "20",
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Coletor ML V2 terminou com codigo ${code}.`)));
  });
  return JSON.parse(fs.readFileSync(RESULT_FILE, "utf8"));
}

async function processar(tarefa) {
  ocupado = true;
  console.log(`[AGENTE] Tarefa ${tarefa.id} · ${tarefa.task_type}`);
  try {
    const result = tarefa.task_type === "product_extract"
      ? await executarProduto(String(tarefa.payload?.url || ""))
      : tarefa.task_type === "coupon_collect"
        ? await executarCupons()
        : null;

    if (!result) throw new Error("Tipo de tarefa desconhecido.");
    await request("/api/local-agent/jobs/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: tarefa.id, sucesso: true, result }),
    });
    console.log(`[AGENTE] Tarefa ${tarefa.id} concluida.`);
  } catch (error) {
    console.error("[AGENTE] Falha:", error.message);
    await request("/api/local-agent/jobs/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: tarefa.id, sucesso: false, error: error.message }),
    }).catch((reportError) => console.error("Nao foi possivel registrar falha:", reportError.message));
  } finally {
    ocupado = false;
  }
}

async function loop() {
  while (!encerrando) {
    if (!ocupado) {
      try {
        const data = await request("/api/local-agent/jobs/claim", { method: "POST" });
        if (data.tarefa) {
          await processar(data.tarefa);
          continue;
        }
      } catch (error) {
        console.error("[AGENTE] Sem conexao com o painel:", error.message);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function shutdown() {
  encerrando = true;
  if (context) await context.close().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

(async () => {
  await iniciarNavegador();
  await loop();
})().catch((error) => {
  console.error("ERRO FATAL DO AGENTE:", error);
  process.exit(1);
});
