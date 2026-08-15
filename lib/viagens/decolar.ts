import * as cheerio from "cheerio";

export type PacoteDecolarExtraido = {
  link_original: string;
  url_final: string;
  titulo: string;
  parceiro: "Decolar";
  origem_codigo: string;
  destino_codigo: string;
  destino_nome: string;
  data_ida: string;
  data_volta: string;
  noites: number | null;
  hotel_nome: string;
  hotel_categoria: string;
  regime_hospedagem: string;
  adultos: number;
  criancas: number;
  companhia_aerea: string;
  bagagem: string;
  preco_total: number | null;
  preco_por_pessoa: number | null;
  moeda: "BRL";
  imagem_url: string;
  observacoes: string;
  radar_slug: string;
  confianca: "alta" | "media" | "baixa";
  campos_detectados: string[];
};

const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

function limparTexto(valor: unknown) {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroBr(valor: string) {
  const limpo = valor
    .replace(/[^\d.,]/g, "")
    .trim();

  if (!limpo) {
    return null;
  }

  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function isoData(valor: string | null) {
  if (!valor) {
    return "";
  }

  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function buscarParametro(
  url: URL,
  nomes: string[]
) {
  for (const nome of nomes) {
    const valor = url.searchParams.get(nome);
    if (valor) {
      return limparTexto(valor);
    }
  }

  return "";
}

function inferirDatasTexto(texto: string) {
  const expressoes = [
    /(?:Hotel\s*\+\s*A[eé]reo[^\d]{0,30})?(?:seg|ter|qua|qui|sex|s[aá]b|dom)?\s*(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*(?:-|a|at[eé])\s*(?:seg|ter|qua|qui|sex|s[aá]b|dom)?\s*(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i,
    /A partir de\s+(?:seg|ter|qua|qui|sex|s[aá]b|dom)?\s*(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez).*?At[eé]\s+(?:seg|ter|qua|qui|sex|s[aá]b|dom)?\s*(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i,
  ];

  let match: RegExpMatchArray | null = null;

  for (const expressao of expressoes) {
    match = texto.match(expressao);
    if (match) {
      break;
    }
  }

  if (!match) {
    return { ida: "", volta: "" };
  }

  const diaIda = Number(match[1]);
  const mesIda = MESES[match[2].toLowerCase()];
  const diaVolta = Number(match[3]);
  const mesVolta = MESES[match[4].toLowerCase()];

  if (!diaIda || !mesIda || !diaVolta || !mesVolta) {
    return { ida: "", volta: "" };
  }

  const hoje = new Date();
  let anoIda = hoje.getFullYear();

  if (mesIda < hoje.getMonth() + 1) {
    anoIda += 1;
  }

  let anoVolta = anoIda;
  if (mesVolta < mesIda) {
    anoVolta += 1;
  }

  const montar = (ano: number, mes: number, dia: number) =>
    `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  return {
    ida: montar(anoIda, mesIda, diaIda),
    volta: montar(anoVolta, mesVolta, diaVolta),
  };
}

function encontrarJsonLdHospedagem(
  $: cheerio.CheerioAPI
) {
  const blocos = $('script[type="application/ld+json"]')
    .map((_, elemento) => $(elemento).text())
    .get();

  const visitar = (valor: any): any => {
    if (!valor) return null;

    if (Array.isArray(valor)) {
      for (const item of valor) {
        const achado = visitar(item);
        if (achado) return achado;
      }
      return null;
    }

    if (typeof valor !== "object") return null;

    const tipo = valor["@type"];
    const tipos = Array.isArray(tipo) ? tipo : [tipo];

    if (
      tipos.some((item) =>
        [
          "Hotel",
          "LodgingBusiness",
          "Resort",
          "Hostel",
          "Accommodation",
        ].includes(String(item))
      ) &&
      valor.name
    ) {
      return valor;
    }

    if (valor["@graph"]) {
      return visitar(valor["@graph"]);
    }

    return null;
  };

  for (const bloco of blocos) {
    try {
      const conteudo = JSON.parse(bloco);
      const achado = visitar(conteudo);
      if (achado) return achado;
    } catch {
      // Ignora JSON-LD inválido.
    }
  }

  return null;
}

function radarPorRota(origem: string, destino: string) {
  const origemNormalizada = origem.toLowerCase();
  const destinoNormalizado = destino.toLowerCase();

  const mapaDestino: Record<string, string> = {
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

  const destinoSlug = mapaDestino[destinoNormalizado];
  if (!destinoSlug) return "";

  const mapaOrigem: Record<string, string> = {
    poa: "poa",
    gru: "gru",
    sao: "gru",
    gig: "gig",
    rio: "gig",
  };

  const origemSlug = mapaOrigem[origemNormalizada];
  return origemSlug ? `${origemSlug}-${destinoSlug}` : "";
}

export async function extrairPacoteDecolar(
  link: string
): Promise<PacoteDecolarExtraido> {
  const urlInformada = new URL(link);

  if (!urlInformada.hostname.toLowerCase().includes("decolar.com")) {
    throw new Error("Informe um link da Decolar.");
  }

  const resposta = await fetch(urlInformada.toString(), {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!resposta.ok) {
    throw new Error(`A Decolar respondeu HTTP ${resposta.status}.`);
  }

  const html = await resposta.text();
  const $ = cheerio.load(html);
  const urlFinal = new URL(resposta.url || urlInformada.toString());

  $("script, style, noscript, svg").remove();
  const textoPagina = limparTexto($("body").text());

  const tituloMeta = limparTexto(
    $('meta[property="og:title"]').attr("content") || $("title").text()
  );

  const imagemUrl = limparTexto(
    $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content")
  );

  const hospedagemJsonLd = encontrarJsonLdHospedagem(cheerio.load(html));

  const headings = cheerio
    .load(html)("h1, h2, h3, h4, h5")
    .map((_, elemento) => limparTexto(cheerio.load(html)(elemento).text()))
    .get()
    .filter(Boolean);

  const destinoHeading = headings.find((texto) =>
    /pacotes?\s+(?:para|em)\s+/i.test(texto)
  );

  const destinoNome = limparTexto(
    destinoHeading?.replace(/^.*?pacotes?\s+(?:para|em)\s+/i, "") ||
      textoPagina.match(/Pacotes?\s+(?:para|em)\s+([A-Za-zÀ-ÿ' -]{2,50})/i)?.[1] ||
      ""
  ).replace(/\s+(?:Hotel|A[eé]reo|Preço).*$/i, "");

  const origemTexto = limparTexto(
    textoPagina.match(/Saindo de\s+([A-Za-zÀ-ÿ' -]{2,50})/i)?.[1] || ""
  ).replace(/\s+(?:Hotel|A[eé]reo|Preço).*$/i, "");

  const rotaCompacta =
    textoPagina.match(/\b([A-Z]{3})([A-Z]{3})\b/) || null;

  const origemCodigo = limparTexto(
    buscarParametro(urlFinal, [
      "from",
      "origin",
      "originCode",
      "departureCity",
      "fromCode",
    ]) ||
      rotaCompacta?.[1] ||
      (origemTexto.match(/\b[A-Z]{3}\b/)?.[0] ?? "")
  ).toUpperCase();

  const destinoCodigo = limparTexto(
    buscarParametro(urlFinal, [
      "to",
      "destination",
      "destinationCode",
      "arrivalCity",
      "toCode",
    ]) ||
      rotaCompacta?.[2] ||
      ""
  ).toUpperCase();

  const noitesMatch = textoPagina.match(/(\d+)\s*Dias?\s*\/\s*(\d+)\s*Noites?/i);
  const noites = noitesMatch ? Number(noitesMatch[2]) : null;

  const dataIdaUrl = isoData(
    buscarParametro(urlFinal, [
      "departureDate",
      "startDate",
      "dateFrom",
      "checkin",
      "checkIn",
    ])
  );

  const dataVoltaUrl = isoData(
    buscarParametro(urlFinal, [
      "returnDate",
      "endDate",
      "dateTo",
      "checkout",
      "checkOut",
    ])
  );

  const datasTexto = inferirDatasTexto(textoPagina);
  const dataIda = dataIdaUrl || datasTexto.ida;
  const dataVolta = dataVoltaUrl || datasTexto.volta;

  const precoPessoaMatch = textoPagina.match(
    /Preço por pessoa\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i
  );

  const precoTotalMatch = textoPagina.match(
    /(?:Total|Final)\s+\d+\s+pessoas?\s*R\$\s*([\d.]+(?:,\d{1,2})?)/i
  );

  const precoPorPessoa = precoPessoaMatch
    ? numeroBr(precoPessoaMatch[1])
    : null;

  const precoTotal = precoTotalMatch
    ? numeroBr(precoTotalMatch[1])
    : null;

  const hotelJson = limparTexto(hospedagemJsonLd?.name);
  const headingHotel = headings.find((texto) => {
    const normalizado = texto.toLowerCase();
    return (
      texto.length > 3 &&
      !normalizado.includes("pacotes de viagem") &&
      !normalizado.includes("pacotes para") &&
      !normalizado.includes("preço") &&
      !normalizado.includes("decolar") &&
      !/^achados/i.test(texto)
    );
  });

  const hotelNome = hotelJson || limparTexto(headingHotel || "");

  const incluiCafe = /(?:inclui\s+)?caf[eé]\s+da\s+manh[aã]/i.test(textoPagina);
  const regimeHospedagem = incluiCafe ? "Café da manhã" : "";

  const bagagens: string[] = [];
  if (/Inclui uma mochila ou bolsa/i.test(textoPagina)) {
    bagagens.push("mochila/bolsa");
  }
  if (/Inclui bagagem de mão/i.test(textoPagina)) {
    bagagens.push("bagagem de mão");
  }
  if (/Inclui bagagem para despachar/i.test(textoPagina)) {
    bagagens.push("bagagem despachada");
  } else if (/Não inclui bagagem para despachar/i.test(textoPagina)) {
    bagagens.push("sem bagagem despachada");
  }

  const adultosParametro = Number(
    buscarParametro(urlFinal, ["adults", "adult", "adt"]) || 2
  );
  const criancasParametro = Number(
    buscarParametro(urlFinal, ["children", "child", "chd"]) || 0
  );

  const adultos = Number.isFinite(adultosParametro) && adultosParametro > 0
    ? adultosParametro
    : 2;

  const criancas = Number.isFinite(criancasParametro) && criancasParametro >= 0
    ? criancasParametro
    : 0;

  const titulo =
    destinoNome && noites
      ? `${destinoNome} • ${noites} noites + aéreo + hotel`
      : destinoNome
        ? `${destinoNome} • aéreo + hotel`
        : tituloMeta || "Pacote Decolar • aéreo + hotel";

  const camposDetectados = Object.entries({
    destino: destinoNome || destinoCodigo,
    origem: origemCodigo || origemTexto,
    datas: dataIda && dataVolta,
    noites,
    hotel: hotelNome,
    preco: precoPorPessoa || precoTotal,
    imagem: imagemUrl,
    bagagem: bagagens.length,
  })
    .filter(([, valor]) => Boolean(valor))
    .map(([campo]) => campo);

  const confianca = camposDetectados.length >= 6
    ? "alta"
    : camposDetectados.length >= 4
      ? "media"
      : "baixa";

  const radarSlug = radarPorRota(
    origemCodigo || origemTexto,
    destinoCodigo || destinoNome
  );

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
    regime_hospedagem: regimeHospedagem,
    adultos,
    criancas,
    companhia_aerea: "",
    bagagem: bagagens.join(" • "),
    preco_total: precoTotal,
    preco_por_pessoa: precoPorPessoa,
    moeda: "BRL",
    imagem_url: imagemUrl,
    observacoes:
      confianca === "baixa"
        ? "Alguns dados não foram detectados automaticamente. Revise antes de publicar."
        : "Dados preparados automaticamente a partir do link original da Decolar. Revise antes de publicar.",
    radar_slug: radarSlug,
    confianca,
    campos_detectados: camposDetectados,
  };
}
