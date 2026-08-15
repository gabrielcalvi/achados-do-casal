import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import type { PacoteDecolarExtraido } from "@/lib/viagens/decolar";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar";

const MAX_CAPTURAS_REDE = 60;
const MAX_CORPO_REDE = 800_000;

type CapturaRede = {
  url: string;
  status: number;
  texto: string;
  origem: "response" | "request";
};

type ValorJson = {
  caminho: string;
  valor: string | number | boolean;
};

type DadosDom = {
  texto: string;
  titulo: string;
  imagem: string;
  headings: string[];
  hotel: string[];
  imagens: Array<{ src: string; largura: number; altura: number }>;
};

function limpar(valor: unknown) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) {
    return null;
  }
  return Math.round((fim - inicio) / 86400000);
}

function decodificarSearchParams(url: URL) {
  const bruto = url.searchParams.get("searchParams") || "";
  if (!bruto) return "";
  try {
    return Buffer.from(
      bruto.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  } catch {
    return "";
  }
}

function datasDaUrl(url: URL) {
  const fonte = `${url.pathname}/${decodificarSearchParams(url)}`;
  const datas = fonte.match(/\d{4}-\d{2}-\d{2}/g) || [];
  return { ida: datas[0] || "", volta: datas[1] || "" };
}

function precoClicadoDaUrl(url: URL) {
  const valor = url.searchParams.get("clickedPrice") || "";
  const match = valor.match(/(?:BRL[_-])?([\d.,]+)/i);
  return match ? numeroBr(match[1]) : null;
}

function passageirosDaUrl(url: URL) {
  const adultosParam = Number(url.searchParams.get("adults") || "");
  const criancasParam = Number(url.searchParams.get("children") || "");
  const searchDecodificada = decodificarSearchParams(url);
  const partes = searchDecodificada.split("/").filter(Boolean);
  const ultimoNumero = Number(partes.at(-1));

  const adultos =
    Number.isFinite(adultosParam) && adultosParam > 0
      ? adultosParam
      : Number.isFinite(ultimoNumero) && ultimoNumero > 0 && ultimoNumero <= 9
        ? ultimoNumero
        : 2;

  const criancas =
    Number.isFinite(criancasParam) && criancasParam >= 0
      ? criancasParam
      : 0;

  return { adultos, criancas };
}

function codigo(texto: string, tipo: "origem" | "destino") {
  const expressoes =
    tipo === "origem"
      ? [
          /(?:Saindo de|Origem|De)\s+[^\n]{0,80}?\(([A-Z]{3})\)/i,
          /(?:Saindo de|Origem|De)\s+([A-Z]{3})\b/i,
        ]
      : [
          /(?:Destino|Para)\s+[^\n]{0,80}?\(([A-Z]{3})\)/i,
          /(?:Destino|Para)\s+([A-Z]{3})\b/i,
        ];

  for (const re of expressoes) {
    const achado = texto.match(re)?.[1];
    if (achado) return achado.toUpperCase();
  }
  return "";
}

function cidade(texto: string, tipo: "origem" | "destino") {
  const expressoes =
    tipo === "origem"
      ? [
          /Saindo de\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+para|\s+Hotel|\s+A[eé]reo|$)/i,
        ]
      : [
          /(?:Destino|Para)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+Hotel|\s+A[eé]reo|$)/i,
          /Pacotes?\s+(?:para|em)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s+-|\s+Hotel|\s+A[eé]reo|$)/i,
        ];

  for (const re of expressoes) {
    const achado = texto.match(re)?.[1];
    if (achado) return limpar(achado);
  }
  return "";
}

function radarPorRota(origem: string, destino: string) {
  const o: Record<string, string> = {
    poa: "poa",
    gru: "gru",
    sao: "gru",
    gig: "gig",
    rio: "gig",
  };
  const d: Record<string, string> = {
    mco: "orlando",
    orlando: "orlando",
    mia: "miami",
    miami: "miami",
    lax: "los-angeles",
    "los angeles": "los-angeles",
    jfk: "new-york",
    ewr: "new-york",
    lga: "new-york",
    nyc: "new-york",
    "new york": "new-york",
    "nova york": "new-york",
    lis: "lisboa",
    lisboa: "lisboa",
    mad: "madrid",
    madrid: "madrid",
  };
  const os = o[origem.toLowerCase()];
  const ds = d[destino.toLowerCase()];
  return os && ds ? `${os}-${ds}` : "";
}

function companhia(texto: string) {
  const nomes = [
    "LATAM",
    "GOL",
    "Azul",
    "Air China",
    "American Airlines",
    "United Airlines",
    "Delta",
    "Copa Airlines",
    "Avianca",
    "TAP",
    "Iberia",
    "Air Europa",
    "Turkish Airlines",
    "Emirates",
    "Qatar Airways",
    "Air France",
    "KLM",
    "Lufthansa",
  ];
  return (
    nomes.find((nome) => texto.toLowerCase().includes(nome.toLowerCase())) || ""
  );
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro || "");
}

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paginaViva(browser: Browser, preferida: Page) {
  if (!preferida.isClosed()) return preferida;
  const paginas = (await browser.pages()).filter((pagina) => !pagina.isClosed());
  return paginas.at(-1) || null;
}

function achatarJson(
  valor: unknown,
  caminho = "",
  saida: ValorJson[] = [],
  profundidade = 0
) {
  if (saida.length >= 14_000 || profundidade > 12 || valor == null) {
    return saida;
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number" ||
    typeof valor === "boolean"
  ) {
    saida.push({ caminho: caminho.toLowerCase(), valor });
    return saida;
  }

  if (Array.isArray(valor)) {
    for (let i = 0; i < Math.min(valor.length, 120); i += 1) {
      achatarJson(valor[i], `${caminho}[${i}]`, saida, profundidade + 1);
    }
    return saida;
  }

  if (typeof valor === "object") {
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      achatarJson(
        item,
        caminho ? `${caminho}.${chave}` : chave,
        saida,
        profundidade + 1
      );
      if (saida.length >= 14_000) break;
    }
  }

  return saida;
}

function primeiroTexto(
  valores: ValorJson[],
  caminho: RegExp,
  validar: (valor: string) => boolean = () => true
) {
  for (const item of valores) {
    if (!caminho.test(item.caminho) || typeof item.valor !== "string") continue;
    const valor = limpar(item.valor);
    if (validar(valor)) return valor;
  }
  return "";
}

function primeiroNumero(valores: ValorJson[], caminho: RegExp) {
  for (const item of valores) {
    if (!caminho.test(item.caminho)) continue;
    const numero =
      typeof item.valor === "number"
        ? item.valor
        : typeof item.valor === "string"
          ? numeroBr(item.valor)
          : null;
    if (numero != null && numero >= 100 && numero <= 10_000_000) {
      return numero;
    }
  }
  return null;
}

function sinaisDaRede(capturas: CapturaRede[]) {
  const valores: ValorJson[] = [];
  const textos: string[] = [];
  let tamanho = 0;

  for (const captura of capturas) {
    if (tamanho < 3_000_000) {
      const trecho = captura.texto.slice(0, 450_000);
      textos.push(trecho);
      tamanho += trecho.length;
    }

    try {
      const json = JSON.parse(captura.texto);
      achatarJson(json, "", valores);
    } catch {
      // Algumas APIs respondem texto; ainda usamos o conteúdo nas regexes.
    }
  }

  const texto = textos.join("\n");

  const origemCodigo = primeiroTexto(
    valores,
    /(?:origin|departure|from).*(?:iata|airport.*code|code)$/i,
    (valor) => /^[A-Z]{3}$/.test(valor)
  );
  const destinoCodigo = primeiroTexto(
    valores,
    /(?:destination|arrival|to).*(?:iata|airport.*code|code)$/i,
    (valor) => /^[A-Z]{3}$/.test(valor)
  );
  const destinoNome = primeiroTexto(
    valores,
    /(?:destination|arrival|to).*(?:city.*name|name|description)$/i,
    (valor) => valor.length >= 2 && valor.length <= 80 && !/^CIT_/i.test(valor)
  );
  const hotelNome = primeiroTexto(
    valores,
    /(?:hotel|accommodation|lodging|property).*(?:name|title)$/i,
    (valor) => valor.length >= 3 && valor.length <= 140 && !/decolar/i.test(valor)
  );
  const imagemUrl = primeiroTexto(
    valores,
    /(?:hotel|accommodation|lodging|property|image|photo|picture).*(?:url|src|image)$/i,
    (valor) => /^https?:\/\//i.test(valor)
  );
  const companhiaAerea =
    primeiroTexto(
      valores,
      /(?:airline|carrier).*(?:name|description)$/i,
      (valor) => valor.length >= 2 && valor.length <= 80
    ) || companhia(texto);

  const precoPorPessoa = primeiroNumero(
    valores,
    /(?:per.?person|person|passenger|adult).*(?:price|amount|value|fare)|(?:price|amount|value|fare).*(?:per.?person|person|passenger|adult)/i
  );
  const precoTotal = primeiroNumero(
    valores,
    /(?:total|package).*(?:price|amount|value)|(?:price|amount|value).*total/i
  );

  return {
    texto,
    origemCodigo,
    destinoCodigo,
    destinoNome,
    hotelNome,
    imagemUrl,
    companhiaAerea,
    precoPorPessoa,
    precoTotal,
  };
}

async function lerDomSeguro(browser: Browser, paginaInicial: Page) {
  const pagina = await paginaViva(browser, paginaInicial);
  if (!pagina) {
    return {
      pagina: null,
      dados: null as DadosDom | null,
      url: "",
    };
  }

  let url = "";
  try {
    url = pagina.url();
  } catch {
    // URL original será usada.
  }

  try {
    const dados = await pagina.evaluate(() => {
      const meta = (seletor: string) =>
        document.querySelector(seletor)?.getAttribute("content") || "";
      const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5"))
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean);
      const hotel = Array.from(
        document.querySelectorAll(
          '[data-testid*="hotel"], [class*="hotel-name"], [class*="accommodation-name"], [class*="hotelName"], [class*="accommodationName"]'
        )
      )
        .map((el) => (el.textContent || "").trim())
        .filter(Boolean);
      const imagens = Array.from(document.images)
        .map((img) => ({
          src: img.currentSrc || img.src || "",
          largura: img.naturalWidth || img.width || 0,
          altura: img.naturalHeight || img.height || 0,
        }))
        .filter((img) => img.src.startsWith("http"))
        .sort((a, b) => b.largura * b.altura - a.largura * a.altura);

      return {
        texto: document.body?.innerText || "",
        titulo:
          meta('meta[property="og:title"]') || document.title || "",
        imagem:
          meta('meta[property="og:image"]') ||
          meta('meta[name="twitter:image"]') ||
          "",
        headings,
        hotel,
        imagens,
      };
    });

    return { pagina, dados, url };
  } catch (erro) {
    console.log(
      `[Pacotes Decolar] DOM indisponivel; seguindo com URL + CDP: ${mensagemErro(erro)}`
    );
    return { pagina, dados: null as DadosDom | null, url };
  }
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

  const executablePath = await chromiumServerless.executablePath(
    CHROMIUM_PACK_URL
  );

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

export async function extrairPacoteDecolarBrowser(
  link: string
): Promise<PacoteDecolarExtraido> {
  const urlInicial = new URL(link);
  const datasUrl = datasDaUrl(urlInicial);
  const passageirosUrl = passageirosDaUrl(urlInicial);
  const precoClicado = precoClicadoDaUrl(urlInicial);
  let browser: Browser | null = null;

  try {
    const { chromiumServerless, executablePath } =
      await prepararChromiumServerless();

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

    const cliente = await paginaInicial.createCDPSession();
    await cliente.send("Page.enable");
    await cliente.send("Network.enable", {
      maxTotalBufferSize: 20_000_000,
      maxResourceBufferSize: 2_000_000,
      maxPostDataSize: 1_000_000,
    });

    const capturas: CapturaRede[] = [];
    const candidatos = new Map<
      string,
      { url: string; status: number; mimeType: string }
    >();
    const pendentes = new Set<Promise<void>>();
    let statusDocumento = 0;

    cliente.on("Network.requestWillBeSent", (evento) => {
      try {
        const url = evento.request.url;
        const postData = evento.request.postData || "";
        if (
          postData &&
          capturas.length < MAX_CAPTURAS_REDE &&
          /graphql|package|hotel|accommodation|offer|price|alternative|search/i.test(
            url
          )
        ) {
          capturas.push({
            url,
            status: 0,
            texto: postData.slice(0, MAX_CORPO_REDE),
            origem: "request",
          });
        }
      } catch {
        // A navegação pode substituir o frame enquanto o evento chega.
      }
    });

    cliente.on("Network.responseReceived", (evento) => {
      try {
        const { response, requestId, type } = evento;
        const url = response.url;
        const mimeType = response.mimeType || "";

        if (type === "Document") {
          statusDocumento = Math.round(response.status || 0);
        }

        const candidata =
          type === "XHR" ||
          type === "Fetch" ||
          /json|graphql/i.test(mimeType) ||
          /graphql|package|hotel|accommodation|offer|price|alternative|search/i.test(
            url
          );

        if (candidata && candidatos.size < 100) {
          candidatos.set(requestId, {
            url,
            status: Math.round(response.status || 0),
            mimeType,
          });
        }
      } catch {
        // Evento incompleto durante troca de renderer.
      }
    });

    cliente.on("Network.loadingFinished", (evento) => {
      const candidato = candidatos.get(evento.requestId);
      if (!candidato || capturas.length >= MAX_CAPTURAS_REDE) return;
      candidatos.delete(evento.requestId);

      const tarefa = cliente
        .send("Network.getResponseBody", { requestId: evento.requestId })
        .then(({ body, base64Encoded }) => {
          const texto = base64Encoded
            ? Buffer.from(body, "base64").toString("utf8")
            : body;

          if (
            texto &&
            texto.length >= 2 &&
            texto.length <= MAX_CORPO_REDE &&
            capturas.length < MAX_CAPTURAS_REDE
          ) {
            capturas.push({
              url: candidato.url,
              status: candidato.status,
              texto,
              origem: "response",
            });
          }
        })
        .catch(() => undefined)
        .then(() => undefined);

      pendentes.add(tarefa);
      tarefa.finally(() => pendentes.delete(tarefa));
    });

    let erroNavegacao = "";
    try {
      const navegacao = await cliente.send("Page.navigate", {
        url: link,
        transitionType: "typed",
      });
      erroNavegacao = navegacao.errorText || "";
    } catch (erro) {
      erroNavegacao = mensagemErro(erro);
      console.log(
        `[Pacotes Decolar] Page.navigate via CDP retornou erro, mas a captura continua: ${erroNavegacao}`
      );
    }

    // A navegação via CDP não fica presa ao lifecycle do Frame. Damos tempo
    // para a SPA disparar suas APIs e capturamos os corpos diretamente da rede.
    await dormir(18_000);
    await Promise.allSettled([...pendentes]);

    console.log(
      `[Pacotes Decolar] CDP capturou ${capturas.length} payload(s): ${capturas
        .slice(0, 10)
        .map((item) => {
          try {
            return new URL(item.url).pathname;
          } catch {
            return item.url.slice(0, 80);
          }
        })
        .join(" | ")}`
    );

    const rede = sinaisDaRede(capturas);
    const dom = await lerDomSeguro(browser, paginaInicial);
    const dadosDom = dom.dados;
    const textoDom = limpar(dadosDom?.texto || "");
    const textoCombinado = limpar(`${textoDom}\n${rede.texto}`);

    let urlFinal = urlInicial;
    try {
      if (dom.url?.startsWith("http")) {
        urlFinal = new URL(dom.url);
      }
    } catch {
      urlFinal = urlInicial;
    }

    const datasFinal = datasDaUrl(urlFinal);
    const dataIda = datasFinal.ida || datasUrl.ida;
    const dataVolta = datasFinal.volta || datasUrl.volta;

    const noitesTexto = textoCombinado.match(
      /(\d+)\s*Dias?\s*\/\s*(\d+)\s*Noites?/i
    );
    const noites = noitesTexto
      ? Number(noitesTexto[2])
      : noitesEntre(dataIda, dataVolta);

    const precoPessoaDom = numeroBr(
      textoDom.match(
        /Preço por pessoa\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i
      )?.[1] ||
        textoDom.match(
          /R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:por pessoa|\/\s*pessoa)/i
        )?.[1]
    );
    const precoTotalDom = numeroBr(
      textoDom.match(
        /(?:Preço total|Total|Final)[^R]{0,80}R\$\s*([\d.]+(?:,\d{1,2})?)/i
      )?.[1]
    );

    const precoPorPessoa =
      precoPessoaDom || rede.precoPorPessoa || precoClicado;

    const origemCodigo =
      codigo(textoDom, "origem") || rede.origemCodigo;
    const destinoCodigo =
      codigo(textoDom, "destino") || rede.destinoCodigo;
    const origemNome = cidade(textoDom, "origem");
    const destinoNome =
      cidade(textoDom, "destino") || rede.destinoNome;

    const headings = (dadosDom?.headings || [])
      .map(limpar)
      .filter((item) => item.length >= 4 && item.length <= 130);
    const hotelNome =
      (dadosDom?.hotel || [])
        .map(limpar)
        .find((item) => item.length >= 4) ||
      headings.find(
        (item) =>
          !/decolar|pacotes?|preço|voo|a[eé]reo|escolha|selecione|detalhes|resumo/i.test(
            item
          )
      ) ||
      rede.hotelNome ||
      "";

    const imagemUrl =
      limpar(dadosDom?.imagem || "") ||
      (dadosDom?.imagens || []).find((img) => img.largura >= 500)?.src ||
      (dadosDom?.imagens || [])[0]?.src ||
      rede.imagemUrl ||
      "";

    const bagagens: string[] = [];
    if (/Inclui uma mochila ou bolsa/i.test(textoCombinado)) {
      bagagens.push("mochila/bolsa");
    }
    if (/Inclui bagagem de mão/i.test(textoCombinado)) {
      bagagens.push("bagagem de mão");
    }
    if (/Inclui bagagem para despachar/i.test(textoCombinado)) {
      bagagens.push("bagagem despachada");
    } else if (/Não inclui bagagem para despachar/i.test(textoCombinado)) {
      bagagens.push("sem bagagem despachada");
    }

    const regime = /all inclusive/i.test(textoCombinado)
      ? "All inclusive"
      : /caf[eé]\s+da\s+manh[aã]|breakfast/i.test(textoCombinado)
        ? "Café da manhã"
        : "";

    const cia = rede.companhiaAerea || companhia(textoCombinado);
    const passageirosFinal = passageirosDaUrl(urlFinal);
    const adultos = passageirosFinal.adultos || passageirosUrl.adultos;
    const criancas = passageirosFinal.criancas ?? passageirosUrl.criancas;

    const precoTotalEncontrado = precoTotalDom || rede.precoTotal || null;
    const precoTotalEstimado =
      !precoTotalEncontrado &&
      precoPorPessoa != null &&
      adultos > 0 &&
      criancas === 0
        ? Number((precoPorPessoa * adultos).toFixed(2))
        : null;
    const precoTotal = precoTotalEncontrado || precoTotalEstimado;

    const titulo = destinoNome && noites
      ? `${destinoNome} • ${noites} noites + aéreo + hotel`
      : destinoNome
        ? `${destinoNome} • aéreo + hotel`
        : limpar(dadosDom?.titulo || "") || "Pacote Decolar • aéreo + hotel";

    const campos = Object.entries({
      destino: destinoNome || destinoCodigo,
      origem: origemCodigo || origemNome,
      datas: dataIda && dataVolta,
      noites,
      hotel: hotelNome,
      preco: precoPorPessoa || precoTotal,
      imagem: imagemUrl,
      companhia: cia,
      bagagem: bagagens.length,
    })
      .filter(([, valor]) => Boolean(valor))
      .map(([chave]) => chave);

    const parcial = !dadosDom || Boolean(erroNavegacao);
    const fontes = [
      dataIda || dataVolta || precoClicado ? "URL" : "",
      capturas.length ? `CDP/rede (${capturas.length})` : "",
      dadosDom ? "DOM" : "",
    ].filter(Boolean);

    if (statusDocumento === 403 && campos.length === 0) {
      throw new Error(
        "A Decolar bloqueou o navegador e o link não continha dados suficientes para preparar o pacote."
      );
    }

    const observacoes: string[] = [];
    observacoes.push(
      parcial
        ? `Preparo parcial automático (${fontes.join(" + ") || "link"}). Revise os campos antes de publicar.`
        : `Dados preparados automaticamente (${fontes.join(" + ")}). Revise antes de publicar.`
    );
    if (precoTotalEstimado) {
      observacoes.push(
        "Preço total estimado automaticamente pelo preço por pessoa × quantidade de adultos; confirme na Decolar antes de publicar."
      );
    }

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
      preco_por_pessoa: precoPorPessoa,
      moeda: "BRL",
      imagem_url: imagemUrl,
      observacoes: observacoes.join(" "),
      radar_slug: radarPorRota(
        origemCodigo || origemNome,
        destinoCodigo || destinoNome
      ),
      confianca:
        campos.length >= 6 ? "alta" : campos.length >= 4 ? "media" : "baixa",
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
