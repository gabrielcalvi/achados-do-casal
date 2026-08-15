import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, {
  type Browser,
  type CDPSession,
  type Page,
  type Target,
} from "puppeteer-core";
import type { PacoteDecolarExtraido } from "@/lib/viagens/decolar";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar";
const MAX_CAPTURAS = 100;
const MAX_CORPO = 1_000_000;

type Captura = {
  url: string;
  status: number;
  texto: string;
};

type Valor = {
  caminho: string;
  valor: string | number | boolean;
};

function limpar(valor: unknown) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numero(valor: unknown) {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const texto = limpar(valor).replace(/[^\d.,]/g, "");
  if (!texto) return null;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : null;
}

function achatar(
  entrada: unknown,
  caminho = "",
  saida: Valor[] = [],
  profundidade = 0
) {
  if (entrada == null || profundidade > 14 || saida.length >= 20_000) {
    return saida;
  }

  if (
    typeof entrada === "string" ||
    typeof entrada === "number" ||
    typeof entrada === "boolean"
  ) {
    saida.push({ caminho: caminho.toLowerCase(), valor: entrada });
    return saida;
  }

  if (Array.isArray(entrada)) {
    for (let i = 0; i < Math.min(entrada.length, 160); i += 1) {
      achatar(entrada[i], `${caminho}[${i}]`, saida, profundidade + 1);
      if (saida.length >= 20_000) break;
    }
    return saida;
  }

  if (typeof entrada === "object") {
    for (const [chave, valor] of Object.entries(
      entrada as Record<string, unknown>
    )) {
      achatar(
        valor,
        caminho ? `${caminho}.${chave}` : chave,
        saida,
        profundidade + 1
      );
      if (saida.length >= 20_000) break;
    }
  }

  return saida;
}

function textoPorCaminho(
  valores: Valor[],
  padrao: RegExp,
  validar: (valor: string) => boolean = () => true
) {
  for (const item of valores) {
    if (!padrao.test(item.caminho) || typeof item.valor !== "string") continue;
    const valor = limpar(item.valor);
    if (validar(valor)) return valor;
  }
  return "";
}

function numeroPorCaminho(valores: Valor[], padrao: RegExp) {
  for (const item of valores) {
    if (!padrao.test(item.caminho)) continue;
    const valor = numero(item.valor);
    if (valor != null && valor >= 10 && valor <= 10_000_000) return valor;
  }
  return null;
}

function companhia(texto: string) {
  const companhias = [
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
    companhias.find((nome) =>
      texto.toLowerCase().includes(nome.toLowerCase())
    ) || ""
  );
}

function analisarCapturas(capturas: Captura[]) {
  const valores: Valor[] = [];
  const textos: string[] = [];
  let totalTexto = 0;

  for (const captura of capturas) {
    if (totalTexto < 4_000_000) {
      const trecho = captura.texto.slice(0, 500_000);
      textos.push(trecho);
      totalTexto += trecho.length;
    }

    try {
      achatar(JSON.parse(captura.texto), "", valores);
    } catch {
      // Algumas respostas podem ser HTML/texto; ainda entram nas regexes.
    }
  }

  const texto = textos.join("\n");

  const hotel = textoPorCaminho(
    valores,
    /(?:hotel|accommodation|property|lodging).*(?:name|title|description)$/i,
    (valor) =>
      valor.length >= 3 &&
      valor.length <= 160 &&
      !/decolar|despegar/i.test(valor)
  );

  const imagem = textoPorCaminho(
    valores,
    /(?:hotel|accommodation|property|image|photo|picture).*(?:url|src|image)$/i,
    (valor) => /^https?:\/\//i.test(valor)
  );

  const cia =
    textoPorCaminho(
      valores,
      /(?:airline|carrier).*(?:name|description|displayname)$/i,
      (valor) => valor.length >= 2 && valor.length <= 100
    ) || companhia(texto);

  const origem = textoPorCaminho(
    valores,
    /(?:origin|departure|from).*(?:iata|airport.*code|code)$/i,
    (valor) => /^[A-Z]{3}$/.test(valor)
  );

  const destino = textoPorCaminho(
    valores,
    /(?:destination|arrival|to).*(?:iata|airport.*code|code)$/i,
    (valor) => /^[A-Z]{3}$/.test(valor)
  );

  const destinoNome = textoPorCaminho(
    valores,
    /(?:destination|arrival).*(?:city.*name|name|description)$/i,
    (valor) =>
      valor.length >= 2 && valor.length <= 100 && !/^CIT_/i.test(valor)
  );

  const precoPessoa = numeroPorCaminho(
    valores,
    /(?:per.?person|person|passenger|adult).*(?:price|amount|value|fare)|(?:price|amount|value|fare).*(?:per.?person|person|passenger|adult)/i
  );

  const precoTotal = numeroPorCaminho(
    valores,
    /(?:package|total).*(?:price|amount|value|fare)|(?:price|amount|value|fare).*total/i
  );

  const estrelas = numeroPorCaminho(
    valores,
    /(?:hotel|accommodation|property).*(?:stars|star.?rating|category)$/i
  );

  const categoriaHotel =
    estrelas != null && estrelas >= 1 && estrelas <= 5
      ? `${Math.round(estrelas)} estrelas`
      : "";

  const regime = /all.?inclusive/i.test(texto)
    ? "All inclusive"
    : /caf[eé]\s+da\s+manh[aã]|breakfast/i.test(texto)
      ? "Café da manhã"
      : "";

  const bagagens: string[] = [];
  if (/bagagem.*(?:23\s*kg|23kg)|23\s*kg.*bagagem/i.test(texto)) {
    bagagens.push("1 mala de 23kg");
  } else if (/checked baggage|bagagem.*despach/i.test(texto)) {
    bagagens.push("bagagem despachada");
  }
  if (/carry.?on|bagagem de m[aã]o/i.test(texto)) {
    bagagens.push("bagagem de mão");
  }

  return {
    texto,
    hotel,
    imagem,
    cia,
    origem,
    destino,
    destinoNome,
    precoPessoa,
    precoTotal,
    categoriaHotel,
    regime,
    bagagem: bagagens.join(" • "),
  };
}

async function prepararChromium() {
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
    throw new Error("Bibliotecas do Chromium serverless não foram preparadas.");
  }

  process.env.LD_LIBRARY_PATH = [
    libDir,
    ...(process.env.LD_LIBRARY_PATH || "")
      .split(":")
      .filter((valor) => valor && valor !== libDir),
  ].join(":");

  return { chromiumServerless, executablePath };
}

export async function enriquecerPacoteDecolarTargets(
  link: string,
  base: PacoteDecolarExtraido
): Promise<PacoteDecolarExtraido> {
  let browser: Browser | null = null;

  try {
    const { chromiumServerless, executablePath } = await prepararChromium();

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

    const capturas: Captura[] = [];
    const pendentes = new Set<Promise<void>>();
    const targetsConfigurados = new WeakSet<Target>();
    const sessoes = new Set<CDPSession>();
    let totalRequisicoes = 0;
    let totalRespostas = 0;
    let corposLidos = 0;
    let totalTargets = 0;

    const adicionar = (captura: Captura) => {
      if (!captura.texto || capturas.length >= MAX_CAPTURAS) return;
      const repetida = capturas.some(
        (item) =>
          item.url === captura.url &&
          item.texto.slice(0, 200) === captura.texto.slice(0, 200)
      );
      if (!repetida) capturas.push(captura);
    };

    async function configurarTarget(target: Target) {
      const tipo = target.type();
      if (!['page', 'iframe'].includes(tipo) || targetsConfigurados.has(target)) {
        return null;
      }

      targetsConfigurados.add(target);
      totalTargets += 1;

      let pagina: Page | null = null;
      try {
        pagina = await target.page();
      } catch {
        pagina = null;
      }

      if (pagina && !pagina.isClosed()) {
        await pagina
          .setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
              "(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
          )
          .catch(() => undefined);
        await pagina
          .setExtraHTTPHeaders({
            "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          })
          .catch(() => undefined);
      }

      const sessao = await target.createCDPSession().catch(() => null);
      if (!sessao) return null;
      sessoes.add(sessao);

      const candidatos = new Map<
        string,
        { url: string; status: number; tipo: string }
      >();

      await sessao.send("Network.enable", {
        maxTotalBufferSize: 24_000_000,
        maxResourceBufferSize: 3_000_000,
        maxPostDataSize: 1_500_000,
      }).catch(() => undefined);
      await sessao
        .send("Network.setCacheDisabled", { cacheDisabled: true })
        .catch(() => undefined);
      await sessao
        .send("Network.setBypassServiceWorker", { bypass: true })
        .catch(() => undefined);
      await sessao
        .send("Fetch.enable", {
          patterns: [
            { urlPattern: "*", resourceType: "XHR", requestStage: "Response" },
            { urlPattern: "*", resourceType: "Fetch", requestStage: "Response" },
          ],
        })
        .catch(() => undefined);

      sessao.on("Network.requestWillBeSent", (evento) => {
        totalRequisicoes += 1;
        const postData = evento.request.postData || "";
        if (
          postData &&
          /graphql|package|hotel|accommodation|offer|price|alternative|search|trip/i.test(
            evento.request.url
          )
        ) {
          adicionar({
            url: evento.request.url,
            status: 0,
            texto: postData.slice(0, MAX_CORPO),
          });
        }
      });

      sessao.on("Network.responseReceived", (evento) => {
        totalRespostas += 1;
        const { requestId, response, type: recurso } = evento;
        const mime = response.mimeType || "";
        const candidata =
          recurso === "XHR" ||
          recurso === "Fetch" ||
          /json|graphql/i.test(mime) ||
          /graphql|package|hotel|accommodation|offer|price|alternative|search|trip/i.test(
            response.url
          );

        if (candidata && candidatos.size < 180) {
          candidatos.set(requestId, {
            url: response.url,
            status: Math.round(response.status || 0),
            tipo: recurso,
          });
        }
      });

      sessao.on("Network.loadingFinished", (evento) => {
        const candidato = candidatos.get(evento.requestId);
        if (!candidato || capturas.length >= MAX_CAPTURAS) return;
        candidatos.delete(evento.requestId);

        const tarefa = sessao
          .send("Network.getResponseBody", { requestId: evento.requestId })
          .then(({ body, base64Encoded }) => {
            const texto = base64Encoded
              ? Buffer.from(body, "base64").toString("utf8")
              : body;
            if (texto && texto.length >= 2 && texto.length <= MAX_CORPO) {
              corposLidos += 1;
              adicionar({
                url: candidato.url,
                status: candidato.status,
                texto,
              });
            }
          })
          .catch(() => undefined)
          .then(() => undefined);

        pendentes.add(tarefa);
        tarefa.finally(() => pendentes.delete(tarefa));
      });

      sessao.on("Fetch.requestPaused", (evento) => {
        const tarefa = (async () => {
          try {
            if (
              evento.responseStatusCode &&
              ![204, 301, 302, 303, 307, 308].includes(
                evento.responseStatusCode
              ) &&
              capturas.length < MAX_CAPTURAS
            ) {
              const corpo = await sessao.send("Fetch.getResponseBody", {
                requestId: evento.requestId,
              });
              const texto = corpo.base64Encoded
                ? Buffer.from(corpo.body, "base64").toString("utf8")
                : corpo.body;
              if (texto && texto.length >= 2 && texto.length <= MAX_CORPO) {
                corposLidos += 1;
                adicionar({
                  url: evento.request.url,
                  status: evento.responseStatusCode,
                  texto,
                });
              }
            }
          } catch {
            // O renderer pode morrer enquanto o corpo está sendo lido.
          } finally {
            await sessao
              .send("Fetch.continueRequest", { requestId: evento.requestId })
              .catch(() => undefined);
          }
        })();

        pendentes.add(tarefa);
        tarefa.finally(() => pendentes.delete(tarefa));
      });

      return sessao;
    }

    const acompanharTarget = (target: Target) => {
      void configurarTarget(target);
    };

    browser.on("targetcreated", acompanharTarget);
    browser.on("targetchanged", acompanharTarget);

    for (const target of browser.targets()) {
      await configurarTarget(target);
    }

    const paginaInicial = await browser.newPage();
    await configurarTarget(paginaInicial.target());

    // O goto pode falhar por frame descartado. A diferença aqui é que a captura
    // está no browser inteiro e continua acompanhando novos targets/renderers.
    void paginaInicial
      .goto(link, { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch((erro) => {
        console.log(
          `[Pacotes Decolar Targets] Navegacao inicial interrompida: ${
            erro instanceof Error ? erro.message : String(erro)
          }`
        );
      });

    const limite = Date.now() + 24_000;
    while (Date.now() < limite) {
      for (const target of browser.targets()) {
        await configurarTarget(target);
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    await Promise.allSettled([...pendentes]);

    let textoDom = "";
    let imagemDom = "";
    let hotelDom = "";

    for (const pagina of await browser.pages().catch(() => [])) {
      if (pagina.isClosed()) continue;
      try {
        const dom = await pagina.evaluate(() => ({
          texto: document.body?.innerText || "",
          imagem:
            document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
            document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
            "",
          headings: Array.from(document.querySelectorAll("h1,h2,h3"))
            .map((el) => (el.textContent || "").trim())
            .filter(Boolean),
        }));
        if (dom.texto.length > textoDom.length) textoDom = dom.texto;
        if (!imagemDom && /^https?:\/\//i.test(dom.imagem)) imagemDom = dom.imagem;
        if (!hotelDom) {
          hotelDom = dom.headings.find(
            (item) =>
              item.length >= 4 &&
              item.length <= 160 &&
              !/decolar|despegar|pacote|voo|detalhes|resumo|escolha/i.test(item)
          ) || "";
        }
      } catch {
        // Página/renderer pode desaparecer durante leitura.
      }
    }

    const analise = analisarCapturas(capturas);
    const textoCombinado = `${textoDom}\n${analise.texto}`;

    const hotel = analise.hotel || hotelDom || base.hotel_nome;
    const imagem = analise.imagem || imagemDom || base.imagem_url;
    const cia = analise.cia || companhia(textoCombinado) || base.companhia_aerea;
    const origem = analise.origem || base.origem_codigo;
    const destino = analise.destino || base.destino_codigo;
    const destinoNome = analise.destinoNome || base.destino_nome;
    const precoPessoa = analise.precoPessoa || base.preco_por_pessoa;
    const precoTotal = analise.precoTotal || base.preco_total;
    const categoria = analise.categoriaHotel || base.hotel_categoria;
    const regime = analise.regime || base.regime_hospedagem;
    const bagagem = analise.bagagem || base.bagagem;

    const campos = new Set(base.campos_detectados || []);
    if (hotel) campos.add("hotel");
    if (imagem) campos.add("imagem");
    if (cia) campos.add("companhia");
    if (origem) campos.add("origem");
    if (destino || destinoNome) campos.add("destino");
    if (precoPessoa || precoTotal) campos.add("preco");
    if (regime) campos.add("regime");
    if (bagagem) campos.add("bagagem");

    const listaCampos = [...campos];
    const confianca =
      listaCampos.length >= 7 ? "alta" : listaCampos.length >= 4 ? "media" : "baixa";

    const diagnostico =
      `Captura global: ${totalTargets} target(s), ${totalRequisicoes} requisição(ões), ` +
      `${totalRespostas} resposta(s), ${corposLidos} corpo(s) lido(s), ${capturas.length} payload(s).`;

    console.log(`[Pacotes Decolar Targets] ${diagnostico}`);

    return {
      ...base,
      origem_codigo: origem,
      destino_codigo: destino,
      destino_nome: destinoNome,
      hotel_nome: hotel,
      hotel_categoria: categoria,
      regime_hospedagem: regime,
      companhia_aerea: cia,
      bagagem,
      preco_total: precoTotal,
      preco_por_pessoa: precoPessoa,
      imagem_url: imagem,
      titulo:
        destinoNome && base.noites
          ? `${destinoNome} • ${base.noites} noites + aéreo + hotel`
          : base.titulo,
      observacoes: `${base.observacoes} ${diagnostico}`.trim(),
      confianca,
      campos_detectados: listaCampos,
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
