import { Sandbox } from "@vercel/sandbox";

const SANDBOX_NAME = "achados-cupons-ml-test";
const BUYER_STATE = "/vercel/tmp/meli-buyer-auth.json";
const AFFILIATE_STATE = "/vercel/tmp/meli-auth.json";
const SCRIPT_PATH = "/vercel/tmp/extrair-produto-ml-auth.cjs";

export type ProdutoMercadoLivreSandbox = {
  nome: string;
  precoAntigo: string;
  precoAtual: string;
  parcelas: string;
  freteGratis: boolean;
  imagem: string;
  imagensGaleria: string[];
  avaliacao: number | null;
  vendas: string;
  urlFinal: string;
};

type ResultadoComando = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function rodar(
  sandbox: Awaited<ReturnType<typeof Sandbox.get>>,
  opcoes: {
    cmd: string;
    args: string[];
    env?: Record<string, string>;
  },
): Promise<ResultadoComando> {
  const resultado = await sandbox.runCommand(opcoes);
  return {
    exitCode: resultado.exitCode,
    stdout: (await resultado.stdout()).trim(),
    stderr: (await resultado.stderr()).trim(),
  };
}

async function existe(
  sandbox: Awaited<ReturnType<typeof Sandbox.get>>,
  arquivo: string,
) {
  const teste = await rodar(sandbox, {
    cmd: "test",
    args: ["-s", arquivo],
  });
  return teste.exitCode === 0;
}

const SCRIPT = String.raw`
const { chromium } = require("playwright");

function limpar(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function preco(valor) {
  const texto = String(valor || "").replace(/[^\d.,]/g, "").trim();
  if (!texto) return "";
  if (texto.includes(".") && texto.includes(",")) {
    return texto.replace(/\./g, "").replace(",", ".");
  }
  return texto.includes(",") ? texto.replace(",", ".") : texto;
}

async function dinheiro(page, seletor) {
  const base = page.locator(seletor).first();
  const inteiro = limpar(
    await base.locator(".andes-money-amount__fraction").textContent().catch(() => "")
  );
  const cents = limpar(
    await base.locator(".andes-money-amount__cents").textContent().catch(() => "")
  );
  return inteiro ? preco(cents ? `${inteiro},${cents}` : inteiro) : "";
}

(async () => {
  const link = process.env.ML_PRODUCT_URL;
  const state = process.env.ML_AUTH_STATE_PATH;

  if (!link || !state) {
    throw new Error("Parametros do extrator autenticado ausentes.");
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1400, height: 900 },
    locale: "pt-BR",
  });
  const page = await context.newPage();

  try {
    await page.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(2200);

    const finalUrl = page.url();
    if (/account-verification|captcha/i.test(finalUrl)) {
      console.log(JSON.stringify({
        sucesso: false,
        sessaoExpirada: true,
        erro: "Sessao do Mercado Livre exige nova verificacao.",
      }));
      return;
    }

    await page
      .locator('h1.ui-pdp-title, .ui-pdp-gallery__figure img, script[type="application/ld+json"]')
      .first()
      .waitFor({ state: "attached", timeout: 15000 })
      .catch(() => undefined);

    let jsonLd = null;
    for (const bloco of await page.locator('script[type="application/ld+json"]').allTextContents().catch(() => [])) {
      try {
        const obj = JSON.parse(bloco);
        const fila = Array.isArray(obj) ? [...obj] : [obj];
        while (fila.length) {
          const atual = fila.shift();
          if (!atual || typeof atual !== "object") continue;
          const tipo = atual["@type"];
          if (tipo === "Product" || (Array.isArray(tipo) && tipo.includes("Product"))) {
            jsonLd = atual;
            fila.length = 0;
            break;
          }
          if (Array.isArray(atual["@graph"])) fila.push(...atual["@graph"]);
        }
        if (jsonLd) break;
      } catch {}
    }

    const oferta = Array.isArray(jsonLd?.offers)
      ? jsonLd.offers[0]
      : jsonLd?.offers || null;

    const nome =
      limpar(jsonLd?.name) ||
      limpar(await page.locator("h1.ui-pdp-title").first().textContent().catch(() => ""));

    const precoAtual =
      (await dinheiro(page, ".ui-pdp-price__second-line")) ||
      preco(oferta?.price) ||
      preco(oferta?.lowPrice);

    let precoAntigo =
      (await dinheiro(page, ".ui-pdp-price__original-value")) ||
      preco(oferta?.highPrice);

    if (precoAntigo && precoAtual && Number(precoAntigo) <= Number(precoAtual)) {
      precoAntigo = "";
    }

    const jsonImages = Array.isArray(jsonLd?.image)
      ? jsonLd.image
      : jsonLd?.image
        ? [jsonLd.image]
        : [];

    const domImages = await page
      .locator(".ui-pdp-gallery__figure img")
      .evaluateAll((imgs) =>
        imgs.flatMap((img) => [
          img.getAttribute("data-zoom"),
          img.getAttribute("src"),
        ]),
      )
      .catch(() => []);

    const ogImage = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute("content")
      .catch(() => "");

    const imagensGaleria = Array.from(
      new Set(
        [...jsonImages, ...domImages, ogImage]
          .map((url) => limpar(url))
          .filter((url) => /^https?:\/\//i.test(url)),
      ),
    );

    const parcelasBrutas = limpar(
      await page
        .locator("text=/\\d+x\\s*R\\$/i")
        .first()
        .innerText()
        .catch(() => ""),
    );

    const parcelas =
      parcelasBrutas
        .replace(/\s*([.,])\s*/g, "$1")
        .match(/\b\d+x\s+R\$\s*\d+(?:[.,]\d{2})?(?:\s+sem juros)?/i)?.[0] ||
      "";

    const freteGratis =
      (await page.locator("text=/Frete grátis/i").count()) > 0;

    const avaliacaoTexto = limpar(
      await page
        .locator(".ui-pdp-review__rating")
        .first()
        .textContent()
        .catch(() => ""),
    );

    const avaliacao = Number(avaliacaoTexto.replace(",", ".")) || null;

    const vendas =
      limpar(
        await page
          .locator(".ui-pdp-subtitle")
          .first()
          .textContent()
          .catch(() => ""),
      )
        .split("|")
        .find((parte) => /vendidos?/i.test(parte))
        ?.trim() || "";

    console.log(JSON.stringify({
      sucesso: true,
      dados: {
        nome,
        precoAntigo,
        precoAtual,
        parcelas,
        freteGratis,
        imagem: imagensGaleria[0] || "",
        imagensGaleria,
        avaliacao,
        vendas,
        urlFinal: finalUrl,
      },
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.log(JSON.stringify({
    sucesso: false,
    erro: error instanceof Error ? error.message : String(error),
  }));
});
`;

export async function extrairMercadoLivreComSessao(
  link: string,
): Promise<
  | { sucesso: true; dados: ProdutoMercadoLivreSandbox }
  | { sucesso: false; sessaoExpirada?: boolean; erro: string }
> {
  let sandbox: Awaited<ReturnType<typeof Sandbox.get>> | null = null;

  try {
    sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const buyer = await existe(sandbox, BUYER_STATE);
    const affiliate = await existe(sandbox, AFFILIATE_STATE);
    const authState = buyer ? BUYER_STATE : affiliate ? AFFILIATE_STATE : "";

    if (!authState) {
      return {
        sucesso: false,
        sessaoExpirada: true,
        erro: "Nenhuma sessao autenticada do Mercado Livre foi encontrada.",
      };
    }

    await sandbox.writeFiles([
      {
        path: SCRIPT_PATH,
        content: Buffer.from(SCRIPT, "utf8"),
        mode: 0o600,
      },
    ]);

    const execucao = await rodar(sandbox, {
      cmd: "xvfb-run",
      args: ["-a", "node", SCRIPT_PATH],
      env: {
        ML_PRODUCT_URL: link,
        ML_AUTH_STATE_PATH: authState,
      },
    });

    const linhaJson = execucao.stdout
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean)
      .reverse()
      .find((linha) => linha.startsWith("{"));

    if (!linhaJson) {
      return {
        sucesso: false,
        erro:
          execucao.stderr ||
          execucao.stdout ||
          "O extrator autenticado nao retornou dados.",
      };
    }

    const resultado = JSON.parse(linhaJson) as
      | { sucesso: true; dados: ProdutoMercadoLivreSandbox }
      | { sucesso: false; sessaoExpirada?: boolean; erro: string };

    return resultado;
  } catch (error) {
    return {
      sucesso: false,
      erro:
        error instanceof Error
          ? error.message
          : "Falha no extrator autenticado do Mercado Livre.",
    };
  }
}
