const { chromium } = require("playwright");

const link = String(process.argv[2] || "").trim();

if (!link) {
  console.error("Link da Decolar nao informado.");
  process.exit(2);
}

function limparTexto(valor) {
  return String(valor || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroBr(valor) {
  const limpo = String(valor || "")
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!limpo) return null;

  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function dataUrl(url, indice) {
  const partes = url.pathname.split("/").filter(Boolean);
  const datas = partes.filter((parte) => /^\d{4}-\d{2}-\d{2}$/.test(parte));
  return datas[indice] || "";
}

function noitesEntre(ida, volta) {
  if (!ida || !volta) return null;

  const inicio = new Date(`${ida}T12:00:00Z`).getTime();
  const fim = new Date(`${volta}T12:00:00Z`).getTime();

  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) {
    return null;
  }

  return Math.round((fim - inicio) / 86400000);
}

function encontrarCodigoAeroporto(texto, antesDepois) {
  const expressoes = antesDepois === "origem"
    ? [
        /(?:Saindo de|Origem|De)\s+[^\n]{0,60}?\(([A-Z]{3})\)/i,
        /(?:Saindo de|Origem|De)\s+([A-Z]{3})\b/i,
      ]
    : [
        /(?:Destino|Para)\s+[^\n]{0,60}?\(([A-Z]{3})\)/i,
        /(?:Destino|Para)\s+([A-Z]{3})\b/i,
      ];

  for (const expressao of expressoes) {
    const match = texto.match(expressao);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return "";
}

function encontrarCidade(texto, tipo) {
  const expressoes = tipo === "origem"
    ? [
        /Saindo de\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+para|\s+Hotel|\s+A[eé]reo|$)/i,
        /Origem\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+Destino|$)/i,
      ]
    : [
        /(?:Destino|Para)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s*\([A-Z]{3}\)|\s+-|\s+Hotel|\s+A[eé]reo|$)/i,
        /Pacotes?\s+(?:para|em)\s+([A-Za-zÀ-ÿ' -]{2,60}?)(?:\s+-|\s+Hotel|\s+A[eé]reo|$)/i,
      ];

  for (const expressao of expressoes) {
    const match = texto.match(expressao);
    if (match?.[1]) return limparTexto(match[1]);
  }

  return "";
}

function encontrarCompanhia(texto) {
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

  return companhias.find((companhia) =>
    new RegExp(companhia.replace(/\s+/g, "\\s+"), "i").test(texto)
  ) || "";
}

(async () => {
  let browser;

  try {
    const urlInicial = new URL(link);

    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
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

    const page = await context.newPage();

    const resposta = await page.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(9000);

    const status = resposta?.status() || 0;
    const urlFinal = new URL(page.url());

    const dadosDom = await page.evaluate(() => {
      const texto = document.body?.innerText || "";
      const meta = (seletor) =>
        document.querySelector(seletor)?.getAttribute("content") || "";

      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5")
      )
        .map((elemento) => (elemento.textContent || "").trim())
        .filter(Boolean);

      const textosHotel = Array.from(
        document.querySelectorAll(
          '[data-testid*="hotel"], [class*="hotel-name"], [class*="accommodation-name"], [class*="hotelName"], [class*="accommodationName"]'
        )
      )
        .map((elemento) => (elemento.textContent || "").trim())
        .filter(Boolean);

      const imagens = Array.from(document.images)
        .map((imagem) => ({
          src: imagem.currentSrc || imagem.src || "",
          width: imagem.naturalWidth || imagem.width || 0,
          height: imagem.naturalHeight || imagem.height || 0,
          alt: imagem.alt || "",
        }))
        .filter((imagem) => imagem.src.startsWith("http"))
        .sort((a, b) => b.width * b.height - a.width * a.height);

      return {
        texto,
        title: document.title || "",
        ogTitle: meta('meta[property="og:title"]'),
        ogImage: meta('meta[property="og:image"]'),
        headings,
        textosHotel,
        imagens,
      };
    });

    const texto = limparTexto(dadosDom.texto);

    if (
      status === 403 ||
      /access denied|forbidden|acesso negado/i.test(texto.slice(0, 1000))
    ) {
      throw new Error("A Decolar bloqueou tambem o navegador do Sandbox.");
    }

    const ida = dataUrl(urlFinal, 0) || dataUrl(urlInicial, 0);
    const volta = dataUrl(urlFinal, 1) || dataUrl(urlInicial, 1);

    const noitesTexto = texto.match(/(\d+)\s*Dias?\s*\/\s*(\d+)\s*Noites?/i);
    const noites = noitesTexto
      ? Number(noitesTexto[2])
      : noitesEntre(ida, volta);

    const precoPessoaMatch =
      texto.match(/Preço por pessoa\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i) ||
      texto.match(/R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:por pessoa|\/\s*pessoa)/i);

    const precoTotalMatch =
      texto.match(/(?:Total|Final)\s+(?:para\s+)?\d+\s+pessoas?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i) ||
      texto.match(/Preço total\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i);

    const precoPorPessoa = precoPessoaMatch
      ? numeroBr(precoPessoaMatch[1])
      : null;

    const precoTotal = precoTotalMatch
      ? numeroBr(precoTotalMatch[1])
      : null;

    const destinoNome = encontrarCidade(texto, "destino");
    const origemNome = encontrarCidade(texto, "origem");
    const origemCodigo = encontrarCodigoAeroporto(texto, "origem");
    const destinoCodigo = encontrarCodigoAeroporto(texto, "destino");

    const headingsFiltrados = dadosDom.headings
      .map(limparTexto)
      .filter((item) =>
        item.length >= 4 &&
        item.length <= 120 &&
        !/decolar|pacotes? de viagem|preço|voo|a[eé]reo|hotel\s*\+/i.test(item)
      );

    const hotelNome =
      dadosDom.textosHotel.map(limparTexto).find((item) => item.length >= 4) ||
      headingsFiltrados.find((item) =>
        item !== destinoNome &&
        item !== origemNome &&
        !/escolha|selecione|detalhes|resumo/i.test(item)
      ) ||
      "";

    const imagemUrl =
      limparTexto(dadosDom.ogImage) ||
      dadosDom.imagens.find((imagem) => imagem.width >= 500)?.src ||
      dadosDom.imagens[0]?.src ||
      "";

    const bagagens = [];
    if (/Inclui uma mochila ou bolsa/i.test(texto)) bagagens.push("mochila/bolsa");
    if (/Inclui bagagem de mão/i.test(texto)) bagagens.push("bagagem de mão");
    if (/Inclui bagagem para despachar/i.test(texto)) {
      bagagens.push("bagagem despachada");
    } else if (/Não inclui bagagem para despachar/i.test(texto)) {
      bagagens.push("sem bagagem despachada");
    }

    const regime = /caf[eé]\s+da\s+manh[aã]/i.test(texto)
      ? "Café da manhã"
      : /all inclusive/i.test(texto)
        ? "All inclusive"
        : "";

    const companhia = encontrarCompanhia(texto);

    const pessoasPath = Number(
      urlFinal.pathname.split("/").filter(Boolean).at(-1)
    );

    const adultos = Number.isFinite(pessoasPath) && pessoasPath > 0
      ? pessoasPath
      : 2;

    const titulo =
      destinoNome && noites
        ? `${destinoNome} • ${noites} noites + aéreo + hotel`
        : destinoNome
          ? `${destinoNome} • aéreo + hotel`
          : limparTexto(dadosDom.ogTitle || dadosDom.title) ||
            "Pacote Decolar • aéreo + hotel";

    const camposDetectados = Object.entries({
      destino: destinoNome || destinoCodigo,
      origem: origemCodigo || origemNome,
      datas: ida && volta,
      noites,
      hotel: hotelNome,
      preco: precoPorPessoa || precoTotal,
      imagem: imagemUrl,
      companhia,
      bagagem: bagagens.length,
    })
      .filter(([, valor]) => Boolean(valor))
      .map(([campo]) => campo);

    const resultado = {
      link_original: link,
      url_final: urlFinal.toString(),
      titulo,
      parceiro: "Decolar",
      origem_codigo: origemCodigo,
      destino_codigo: destinoCodigo,
      destino_nome: destinoNome,
      data_ida: ida,
      data_volta: volta,
      noites,
      hotel_nome: hotelNome,
      hotel_categoria: "",
      regime_hospedagem: regime,
      adultos,
      criancas: 0,
      companhia_aerea: companhia,
      bagagem: bagagens.join(" • "),
      preco_total: precoTotal,
      preco_por_pessoa: precoPorPessoa,
      moeda: "BRL",
      imagem_url: imagemUrl,
      observacoes:
        "Dados preparados pelo navegador seguro da Decolar. Revise antes de publicar.",
      radar_slug: "",
      confianca:
        camposDetectados.length >= 6
          ? "alta"
          : camposDetectados.length >= 4
            ? "media"
            : "baixa",
      campos_detectados: camposDetectados,
      origem_nome_detectada: origemNome,
      status_http: status,
    };

    process.stdout.write(JSON.stringify(resultado));
  } catch (erro) {
    console.error(
      erro instanceof Error ? erro.message : String(erro)
    );
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
})();
