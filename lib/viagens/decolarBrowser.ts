import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { PacoteDecolarExtraido } from "@/lib/viagens/decolar";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar";

function limpar(valor: unknown) {
  return String(valor ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function numeroBr(valor: string | undefined) {
  if (!valor) return null;
  const limpo = valor.replace(/[^\d.,]/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function noitesEntre(ida: string, volta: string) {
  if (!ida || !volta) return null;
  const inicio = Date.parse(`${ida}T12:00:00Z`);
  const fim = Date.parse(`${volta}T12:00:00Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return null;
  return Math.round((fim - inicio) / 86400000);
}

function decodificarSearchParams(url: URL) {
  const bruto = url.searchParams.get("searchParams") || "";
  if (!bruto) return "";
  try {
    return Buffer.from(bruto.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function datasDaUrl(url: URL) {
  const fonte = `${url.pathname}/${decodificarSearchParams(url)}`;
  const datas = fonte.match(/\d{4}-\d{2}-\d{2}/g) || [];
  return { ida: datas[0] || "", volta: datas[1] || "" };
}

function codigo(texto: string, tipo: "origem" | "destino") {
  const expressoes = tipo === "origem"
    ? [/(?:Saindo de|Origem|De)\s+[^\n]{0,80}?\(([A-Z]{3})\)/i, /(?:Saindo de|Origem|De)\s+([A-Z]{3})\b/i]
    : [/(?:Destino|Para)\s+[^\n]{0,80}?\(([A-Z]{3})\)/i, /(?:Destino|Para)\s+([A-Z]{3})\b/i];
  for (const re of expressoes) {
    const achado = texto.match(re)?.[1];
    if (achado) return achado.toUpperCase();
  }
  return "";
}

function cidade(texto: string, tipo: "origem" | "destino") {
  const expressoes = tipo === "origem"
    ? [/Saindo de\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+para|\s+Hotel|\s+A[eé]reo|$)/i]
    : [/(?:Destino|Para)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+Hotel|\s+A[eé]reo|$)/i, /Pacotes?\s+(?:para|em)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s+-|\s+Hotel|\s+A[eé]reo|$)/i];
  for (const re of expressoes) {
    const achado = texto.match(re)?.[1];
    if (achado) return limpar(achado);
  }
  return "";
}

function radarPorRota(origem: string, destino: string) {
  const o: Record<string, string> = { poa: "poa", gru: "gru", sao: "gru", gig: "gig", rio: "gig" };
  const d: Record<string, string> = {
    mco: "orlando", orlando: "orlando", mia: "miami", miami: "miami",
    lax: "los-angeles", "los angeles": "los-angeles", jfk: "new-york", ewr: "new-york",
    lga: "new-york", nyc: "new-york", "new york": "new-york", "nova york": "new-york",
    lis: "lisboa", lisboa: "lisboa", mad: "madrid", madrid: "madrid",
  };
  const os = o[origem.toLowerCase()];
  const ds = d[destino.toLowerCase()];
  return os && ds ? `${os}-${ds}` : "";
}

function companhia(texto: string) {
  const nomes = [
    "LATAM", "GOL", "Azul", "Air China", "American Airlines", "United Airlines",
    "Delta", "Copa Airlines", "Avianca", "TAP", "Iberia", "Air Europa",
    "Turkish Airlines", "Emirates", "Qatar Airways", "Air France", "KLM", "Lufthansa",
  ];
  return nomes.find((nome) => texto.toLowerCase().includes(nome.toLowerCase())) || "";
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro || "");
}

function navegacaoPodeContinuar(erro: unknown) {
  return /navigating frame was detached|execution context was destroyed|cannot find context with specified id|net::err_aborted/i.test(
    mensagemErro(erro)
  );
}

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paginaViva(browser: Browser, preferida: Page) {
  if (!preferida.isClosed()) return preferida;
  const paginas = (await browser.pages()).filter((pagina) => !pagina.isClosed());
  return paginas.at(-1) || null;
}

async function navegarAteEstabilizar(browser: Browser, paginaInicial: Page, link: string) {
  let pagina = paginaInicial;
  let status = 0;

  const registrarStatus = (resposta: import("puppeteer-core").HTTPResponse) => {
    try {
      const requisicao = resposta.request();
      if (requisicao.isNavigationRequest() && requisicao.resourceType() === "document") {
        status = resposta.status();
      }
    } catch {
      // A Decolar pode descartar o frame durante redirects internos.
    }
  };

  pagina.on("response", registrarStatus);

  try {
    const resposta = await pagina.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    status = resposta?.status() || status;
  } catch (erro) {
    if (!navegacaoPodeContinuar(erro)) {
      throw erro;
    }
    console.log(
      `[Pacotes Decolar] Navegacao trocou o frame principal; aguardando estabilizacao: ${mensagemErro(erro)}`
    );
  }

  const limite = Date.now() + 30000;
  let ultimaUrl = "";
  let leiturasEstaveis = 0;
  let ultimoErro = "";

  while (Date.now() < limite) {
    const candidata = await paginaViva(browser, pagina);
    if (!candidata) {
      throw new Error("O navegador da Decolar fechou todas as paginas durante a navegacao.");
    }
    pagina = candidata;

    try {
      const estado = await pagina.evaluate(() => ({
        href: window.location.href,
        readyState: document.readyState,
        tamanhoTexto: document.body?.innerText?.length || 0,
      }));

      const urlUtil = estado.href.startsWith("http");
      const documentoUtil = estado.readyState !== "loading" && estado.tamanhoTexto >= 80;

      if (urlUtil && documentoUtil) {
        if (estado.href === ultimaUrl) {
          leiturasEstaveis += 1;
        } else {
          ultimaUrl = estado.href;
          leiturasEstaveis = 1;
        }

        if (leiturasEstaveis >= 2) {
          pagina.off("response", registrarStatus);
          return { pagina, status };
        }
      } else {
        leiturasEstaveis = 0;
      }
    } catch (erro) {
      ultimoErro = mensagemErro(erro);
      if (!navegacaoPodeContinuar(erro) && !/target closed|session closed/i.test(ultimoErro)) {
        console.log(`[Pacotes Decolar] Documento ainda nao estabilizou: ${ultimoErro}`);
      }
      leiturasEstaveis = 0;
    }

    await dormir(1000);
  }

  pagina.off("response", registrarStatus);
  throw new Error(
    `A Decolar nao estabilizou a pagina apos os redirects${ultimoErro ? `: ${ultimoErro}` : "."}`
  );
}

async function prepararChromiumServerless() {
  const libDir = join(tmpdir(), "al2023", "lib");
  const libNspr = join(libDir, "libnspr4.so");
  const chromiumPath = join(tmpdir(), "chromium");

  process.env.VERCEL ||= "1";

  if (existsSync(chromiumPath) && !existsSync(libNspr)) {
    rmSync(chromiumPath, { force: true });
    rmSync(join(tmpdir(), "chromium-pack"), { recursive: true, force: true });
    rmSync(join(tmpdir(), "al2023"), { recursive: true, force: true });
  }

  const modulo = await import("@sparticuz/chromium-min");
  const chromiumServerless = modulo.default;
  chromiumServerless.setGraphicsMode = false;

  const executablePath = await chromiumServerless.executablePath(CHROMIUM_PACK_URL);

  if (!existsSync(libNspr)) {
    throw new Error(
      "Chromium foi extraído, mas as bibliotecas AL2023 não foram preparadas (libnspr4.so ausente)."
    );
  }

  const caminhosAtuais = (process.env.LD_LIBRARY_PATH || "")
    .split(":")
    .filter(Boolean);

  process.env.LD_LIBRARY_PATH = [
    libDir,
    ...caminhosAtuais.filter((caminho) => caminho !== libDir),
  ].join(":");

  return { chromiumServerless, executablePath };
}

export async function extrairPacoteDecolarBrowser(link: string): Promise<PacoteDecolarExtraido> {
  const urlInicial = new URL(link);
  let browser: Browser | null = null;

  try {
    const { chromiumServerless, executablePath } = await prepararChromiumServerless();

    browser = await puppeteer.launch({
      executablePath,
      args: puppeteer.defaultArgs({
        args: chromiumServerless.args,
        headless: "shell",
      }),
      headless: "shell",
      defaultViewport: {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: true,
        isMobile: false,
      },
      env: process.env,
    });

    const paginaInicial = await browser.newPage();
    await paginaInicial.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
    );
    await paginaInicial.setExtraHTTPHeaders({
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    });

    const navegacao = await navegarAteEstabilizar(browser, paginaInicial, link);
    const pagina = navegacao.pagina;
    const status = navegacao.status;

    // Dá alguns segundos para os cards/preços carregados pelo app da Decolar
    // aparecerem depois que a navegação principal estabiliza.
    await dormir(5000);

    const dados = await pagina.evaluate(() => {
      const meta = (seletor: string) => document.querySelector(seletor)?.getAttribute("content") || "";
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5"))
        .map((el) => (el.textContent || "").trim()).filter(Boolean);
      const hotel = Array.from(document.querySelectorAll(
        '[data-testid*="hotel"], [class*="hotel-name"], [class*="accommodation-name"], [class*="hotelName"], [class*="accommodationName"]'
      )).map((el) => (el.textContent || "").trim()).filter(Boolean);
      const imagens = Array.from(document.images).map((img) => ({
        src: img.currentSrc || img.src || "", largura: img.naturalWidth || img.width || 0,
        altura: img.naturalHeight || img.height || 0,
      })).filter((img) => img.src.startsWith("http")).sort((a,b) => b.largura*b.altura - a.largura*a.altura);
      return {
        texto: document.body?.innerText || "",
        titulo: meta('meta[property="og:title"]') || document.title || "",
        imagem: meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || "",
        headings, hotel, imagens,
      };
    });

    const texto = limpar(dados.texto);
    if (status === 403 || /access denied|forbidden|acesso negado/i.test(texto.slice(0, 1500))) {
      throw new Error("A Decolar bloqueou também o navegador serverless (HTTP 403).");
    }

    const urlFinal = new URL(pagina.url());
    const datas = datasDaUrl(urlFinal);
    const fallbackDatas = datasDaUrl(urlInicial);
    const dataIda = datas.ida || fallbackDatas.ida;
    const dataVolta = datas.volta || fallbackDatas.volta;

    const noitesTexto = texto.match(/(\d+)\s*Dias?\s*\/\s*(\d+)\s*Noites?/i);
    const noites = noitesTexto ? Number(noitesTexto[2]) : noitesEntre(dataIda, dataVolta);

    const precoPessoa = numeroBr(
      texto.match(/Preço por pessoa\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1] ||
      texto.match(/R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:por pessoa|\/\s*pessoa)/i)?.[1]
    );
    const precoTotal = numeroBr(
      texto.match(/(?:Preço total|Total|Final)[^R]{0,80}R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1]
    );

    const origemCodigo = codigo(texto, "origem");
    const destinoCodigo = codigo(texto, "destino");
    const origemNome = cidade(texto, "origem");
    const destinoNome = cidade(texto, "destino");

    const headings = dados.headings.map(limpar).filter((item) => item.length >= 4 && item.length <= 130);
    const hotelNome = dados.hotel.map(limpar).find((item) => item.length >= 4) ||
      headings.find((item) => !/decolar|pacotes?|preço|voo|a[eé]reo|escolha|selecione|detalhes|resumo/i.test(item)) || "";
    const imagemUrl = limpar(dados.imagem) || dados.imagens.find((img) => img.largura >= 500)?.src || dados.imagens[0]?.src || "";

    const bagagens: string[] = [];
    if (/Inclui uma mochila ou bolsa/i.test(texto)) bagagens.push("mochila/bolsa");
    if (/Inclui bagagem de mão/i.test(texto)) bagagens.push("bagagem de mão");
    if (/Inclui bagagem para despachar/i.test(texto)) bagagens.push("bagagem despachada");
    else if (/Não inclui bagagem para despachar/i.test(texto)) bagagens.push("sem bagagem despachada");

    const regime = /all inclusive/i.test(texto) ? "All inclusive" : /caf[eé]\s+da\s+manh[aã]/i.test(texto) ? "Café da manhã" : "";
    const cia = companhia(texto);
    const adultosUrl = Number(urlFinal.searchParams.get("adults") || urlInicial.searchParams.get("adults") || 2);
    const criancasUrl = Number(urlFinal.searchParams.get("children") || urlInicial.searchParams.get("children") || 0);
    const adultos = Number.isFinite(adultosUrl) && adultosUrl > 0 ? adultosUrl : 2;
    const criancas = Number.isFinite(criancasUrl) && criancasUrl >= 0 ? criancasUrl : 0;

    const titulo = destinoNome && noites
      ? `${destinoNome} • ${noites} noites + aéreo + hotel`
      : destinoNome ? `${destinoNome} • aéreo + hotel` : limpar(dados.titulo) || "Pacote Decolar • aéreo + hotel";

    const campos = Object.entries({
      destino: destinoNome || destinoCodigo, origem: origemCodigo || origemNome,
      datas: dataIda && dataVolta, noites, hotel: hotelNome,
      preco: precoPessoa || precoTotal, imagem: imagemUrl, companhia: cia, bagagem: bagagens.length,
    }).filter(([,valor]) => Boolean(valor)).map(([chave]) => chave);

    return {
      link_original: link,
      url_final: urlFinal.toString(),
      titulo,
      parceiro: "Decolar",
      origem_codigo: origemCodigo,
      destino_codigo: destinoCodigo,
      destino_nome: destinoNome,
      data_ida: dataIda,
      data_volta: dataVolta,
      noites,
      hotel_nome: hotelNome,
      hotel_categoria: "",
      regime_hospedagem: regime,
      adultos,
      criancas,
      companhia_aerea: cia,
      bagagem: bagagens.join(" • "),
      preco_total: precoTotal,
      preco_por_pessoa: precoPessoa,
      moeda: "BRL",
      imagem_url: imagemUrl,
      observacoes: "Dados preparados automaticamente pelo navegador serverless da Decolar. Revise antes de publicar.",
      radar_slug: radarPorRota(origemCodigo || origemNome, destinoCodigo || destinoNome),
      confianca: campos.length >= 6 ? "alta" : campos.length >= 4 ? "media" : "baixa",
      campos_detectados: campos,
    };
  } finally {
    if (browser) {
      for (const pagina of await browser.pages().catch(() => [])) {
        await pagina.close().catch(() => undefined);
      }
      await browser.close().catch(() => undefined);
    }
  }
}
