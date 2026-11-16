import { load } from "cheerio";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const BLACK_FRIDAY_ORIGEM = "black_friday_radar_2026";
export const BLACK_FRIDAY_FIM = "2026-12-03T03:00:00.000Z";

export type LojaBlackFriday = {
  nome: string;
  slug: string;
  dominio: string;
  homepage: string;
};

export const LOJAS_BLACK_FRIDAY: LojaBlackFriday[] = [
  { nome: "Adidas", slug: "adidas", dominio: "adidas.com.br", homepage: "https://www.adidas.com.br/" },
  { nome: "Magalu", slug: "magalu", dominio: "magazineluiza.com.br", homepage: "https://www.magazineluiza.com.br/" },
  { nome: "Casas Bahia", slug: "casas-bahia", dominio: "casasbahia.com.br", homepage: "https://www.casasbahia.com.br/" },
  { nome: "Renner", slug: "renner", dominio: "lojasrenner.com.br", homepage: "https://www.lojasrenner.com.br/" },
  { nome: "C&A", slug: "cea", dominio: "cea.com.br", homepage: "https://www.cea.com.br/" },
  { nome: "Nike", slug: "nike", dominio: "nike.com.br", homepage: "https://www.nike.com.br/" },
  { nome: "Samsung", slug: "samsung", dominio: "samsung.com.br", homepage: "https://www.samsung.com/br/" },
  { nome: "Dell", slug: "dell", dominio: "dell.com.br", homepage: "https://www.dell.com/pt-br" },
  { nome: "Lenovo", slug: "lenovo", dominio: "lenovo.com.br", homepage: "https://www.lenovo.com/br/pt/" },
  { nome: "Riachuelo", slug: "riachuelo", dominio: "riachuelo.com.br", homepage: "https://www.riachuelo.com.br/" },
  { nome: "Centauro", slug: "centauro", dominio: "centauro.com.br", homepage: "https://www.centauro.com.br/" },
  { nome: "Netshoes", slug: "netshoes", dominio: "netshoes.com.br", homepage: "https://www.netshoes.com.br/" },
  { nome: "Sephora", slug: "sephora", dominio: "sephora.com.br", homepage: "https://www.sephora.com.br/" },
  { nome: "O Boticário", slug: "boticario", dominio: "boticario.com.br", homepage: "https://www.boticario.com.br/" },
  { nome: "Natura", slug: "natura", dominio: "natura.com.br", homepage: "https://www.natura.com.br/" },
  { nome: "Petz", slug: "petz", dominio: "petz.com.br", homepage: "https://www.petz.com.br/" },
  { nome: "Fast Shop", slug: "fast-shop", dominio: "fastshop.com.br", homepage: "https://www.fastshop.com.br/" },
  { nome: "Carrefour", slug: "carrefour", dominio: "carrefour.com.br", homepage: "https://www.carrefour.com.br/" },
  { nome: "Pichau", slug: "pichau", dominio: "pichau.com.br", homepage: "https://www.pichau.com.br/" },
  { nome: "Electrolux", slug: "electrolux", dominio: "electrolux.com.br", homepage: "https://loja.electrolux.com.br/" },
  { nome: "Brastemp", slug: "brastemp", dominio: "brastemp.com.br", homepage: "https://www.brastemp.com.br/" },
  { nome: "Marisa", slug: "marisa", dominio: "marisa.com.br", homepage: "https://www.marisa.com.br/" },
  { nome: "Gaston", slug: "gaston", dominio: "gaston.com.br", homepage: "https://www.gaston.com.br/" },
  { nome: "Apple", slug: "apple", dominio: "apple.com", homepage: "https://www.apple.com/br/store" },
  { nome: "Amazon", slug: "amazon", dominio: "amazon.com.br", homepage: "https://www.amazon.com.br/" },
  { nome: "Americanas", slug: "americanas", dominio: "americanas.com.br", homepage: "https://www.americanas.com.br/" },
  { nome: "Decathlon", slug: "decathlon", dominio: "decathlon.com.br", homepage: "https://www.decathlon.com.br/" },
  { nome: "Dafiti", slug: "dafiti", dominio: "dafiti.com.br", homepage: "https://www.dafiti.com.br/" },
  { nome: "Zattini", slug: "zattini", dominio: "zattini.com.br", homepage: "https://www.zattini.com.br/" },
  { nome: "Nespresso", slug: "nespresso", dominio: "nespresso.com", homepage: "https://www.nespresso.com/br/pt/" },
  { nome: "Nescafe Dolce Gusto", slug: "dolce-gusto", dominio: "nescafe-dolcegusto.com.br", homepage: "https://www.nescafe-dolcegusto.com.br/" },
  { nome: "Cafe L'OR", slug: "cafe-lor", dominio: "br.lorcoffee.com", homepage: "https://www.br.lorcoffee.com/" },
  { nome: "Baggio Cafe", slug: "baggio-cafe", dominio: "baggiocafe.com.br", homepage: "https://www.baggiocafe.com.br/" },
  { nome: "GoCase", slug: "gocase", dominio: "gocase.com.br", homepage: "https://www.gocase.com.br/" },
  { nome: "Superlegal Brinquedos", slug: "superlegal", dominio: "superlegalbrinquedos.com.br", homepage: "https://www.superlegalbrinquedos.com.br/" },
  { nome: "Ri Happy", slug: "ri-happy", dominio: "rihappy.com.br", homepage: "https://www.rihappy.com.br/" },
  { nome: "PBKIDS", slug: "pbkids", dominio: "pbkids.com.br", homepage: "https://www.pbkids.com.br/" },
  { nome: "Lojas Colombo", slug: "colombo", dominio: "colombo.com.br", homepage: "https://www.colombo.com.br/" },
  { nome: "Pontofrio", slug: "ponto-frio", dominio: "pontofrio.com.br", homepage: "https://www.pontofrio.com.br/" },
  { nome: "LEGO", slug: "lego", dominio: "lego.com", homepage: "https://www.lego.com/pt-br" },
  { nome: "Mattel", slug: "mattel", dominio: "mattel.com", homepage: "https://shop.mattel.com/pt-br" },
  { nome: "Steam", slug: "steam", dominio: "steampowered.com", homepage: "https://store.steampowered.com/" },
  { nome: "PlayStation Store", slug: "playstation-store", dominio: "playstation.com", homepage: "https://store.playstation.com/pt-br/" },
  { nome: "Sony", slug: "sony", dominio: "sony.com.br", homepage: "https://www.sony.com.br/" },
  { nome: "LG", slug: "lg", dominio: "lg.com", homepage: "https://www.lg.com/br/" },
  { nome: "AliExpress", slug: "aliexpress", dominio: "aliexpress.com", homepage: "https://pt.aliexpress.com/" },
  { nome: "Temu", slug: "temu", dominio: "temu.com", homepage: "https://www.temu.com/br/" },
  { nome: "Havan", slug: "havan", dominio: "havan.com.br", homepage: "https://www.havan.com.br/" },
  { nome: "Motorola", slug: "motorola", dominio: "motorola.com.br", homepage: "https://www.motorola.com.br/" },
  { nome: "Olympikus", slug: "olympikus", dominio: "olympikus.com.br", homepage: "https://www.olympikus.com.br/" },
  { nome: "Havaianas", slug: "havaianas", dominio: "havaianas.com.br", homepage: "https://www.havaianas.com.br/" },
  { nome: "Kalunga", slug: "kalunga", dominio: "kalunga.com.br", homepage: "https://www.kalunga.com.br/" },
  { nome: "Leroy Merlin", slug: "leroy-merlin", dominio: "leroymerlin.com.br", homepage: "https://www.leroymerlin.com.br/" },
  { nome: "Vivara", slug: "vivara", dominio: "vivara.com.br", homepage: "https://www.vivara.com.br/" },
  { nome: "Tok&Stok", slug: "tokstok", dominio: "tokstok.com.br", homepage: "https://www.tokstok.com.br/" },
  { nome: "Drogasil", slug: "drogasil", dominio: "drogasil.com.br", homepage: "https://www.drogasil.com.br/" },
  { nome: "Droga Raia", slug: "droga-raia", dominio: "drogaraia.com.br", homepage: "https://www.drogaraia.com.br/" },
  { nome: "Pague Menos", slug: "pague-menos", dominio: "paguemenos.com.br", homepage: "https://www.paguemenos.com.br/" },
  { nome: "Panvel", slug: "panvel", dominio: "panvel.com", homepage: "https://www.panvel.com/" },
  { nome: "Drogaria São Paulo", slug: "drogaria-sp", dominio: "drogariasaopaulo.com.br", homepage: "https://www.drogariasaopaulo.com.br/" },
  { nome: "Eudora", slug: "eudora", dominio: "eudora.com.br", homepage: "https://www.eudora.com.br/" },
  { nome: "Beleza na Web", slug: "beleza-na-web", dominio: "belezanaweb.com.br", homepage: "https://www.belezanaweb.com.br/" },
  { nome: "Época Cosméticos", slug: "epoca-cosmeticos", dominio: "epocacosmeticos.com.br", homepage: "https://www.epocacosmeticos.com.br/" },
  { nome: "Granado", slug: "granado", dominio: "granado.com.br", homepage: "https://www.granado.com.br/" },
  { nome: "Cacau Show", slug: "cacau-show", dominio: "cacaushow.com.br", homepage: "https://www.cacaushow.com.br/" },
  { nome: "Kopenhagen", slug: "kopenhagen", dominio: "kopenhagen.com.br", homepage: "https://www.kopenhagen.com.br/" },
  { nome: "Lindt", slug: "lindt", dominio: "lindt.com.br", homepage: "https://www.lindt.com.br/" },
  { nome: "Swift", slug: "swift", dominio: "swift.com.br", homepage: "https://www.swift.com.br/" },
  { nome: "Puma", slug: "puma", dominio: "br.puma.com", homepage: "https://br.puma.com/" },
  { nome: "Fila", slug: "fila", dominio: "fila.com.br", homepage: "https://www.fila.com.br/" },
  { nome: "Mizuno", slug: "mizuno", dominio: "mizuno.com.br", homepage: "https://www.mizuno.com.br/" },
  { nome: "AutoZone", slug: "autozone", dominio: "autozone.com.br", homepage: "https://www.autozone.com.br/" },
  { nome: "PneuStore", slug: "pneustore", dominio: "pneustore.com.br", homepage: "https://www.pneustore.com.br/" },
  { nome: "Booking.com", slug: "booking", dominio: "booking.com", homepage: "https://www.booking.com/" },
  { nome: "Hoteis.com", slug: "hoteis-com", dominio: "hoteis.com", homepage: "https://www.hoteis.com/" },
  { nome: "Airbnb", slug: "airbnb", dominio: "airbnb.com.br", homepage: "https://www.airbnb.com.br/" },
  { nome: "LATAM", slug: "latam", dominio: "latamairlines.com", homepage: "https://www.latamairlines.com/br/pt" },
  { nome: "GOL", slug: "gol", dominio: "voegol.com.br", homepage: "https://www.voegol.com.br/" },
  { nome: "Avianca", slug: "avianca", dominio: "avianca.com", homepage: "https://www.avianca.com/pt_br/" },
  { nome: "MSC Cruzeiros", slug: "msc-cruzeiros", dominio: "msccruzeiros.com.br", homepage: "https://www.msccruzeiros.com.br/" },
  { nome: "Localiza", slug: "localiza", dominio: "localiza.com", homepage: "https://www.localiza.com/brasil/pt-br" },
  { nome: "Movida", slug: "movida", dominio: "movida.com.br", homepage: "https://www.movida.com.br/" },
  { nome: "Rentcars", slug: "rentcars", dominio: "rentcars.com", homepage: "https://www.rentcars.com/" },
  { nome: "Civitatis", slug: "civitatis", dominio: "civitatis.com", homepage: "https://www.civitatis.com/pt/" },
  { nome: "Beach Park", slug: "beach-park", dominio: "beachpark.com.br", homepage: "https://www.beachpark.com.br/" },
  { nome: "CVC", slug: "cvc", dominio: "cvc.com.br", homepage: "https://www.cvc.com.br/" },
  { nome: "Trip.com", slug: "trip-com", dominio: "trip.com", homepage: "https://br.trip.com/" },
  { nome: "ITA Airways", slug: "ita-airways", dominio: "ita-airways.com", homepage: "https://www.ita-airways.com/" },
  { nome: "Iberostar", slug: "iberostar", dominio: "iberostar.com", homepage: "https://www.iberostar.com/" },

];

type ResultadoBusca = {
  titulo: string;
  url: string;
  snippet: string;
};

export type CupomDescoberto = {
  codigo: string;
  titulo: string;
  tipoDesconto: "percentual" | "valor_fixo" | "frete_gratis" | "outro";
  descontoPercentual: number | null;
  valorDesconto: number | null;
  inicio: string | null;
  validade: string | null;
  ultimoUso: string | null;
  publicadoNaFonte: boolean;
  score: number;
  autoAprovado: boolean;
  fonteUrl: string;
  fonteHost: string;
  fonteOficial?: boolean;
  fonteNome?: string;
};

function decodeTexto(valor: string | null | undefined) {
  if (!valor) return "";
  try {
    return JSON.parse(`"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return valor
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .replaceAll("\\/", "/");
  }
}

function urlResultadoDuckDuckGo(href: string) {
  try {
    const absoluta = href.startsWith("//") ? `https:${href}` : href;
    const url = new URL(absoluta);
    const destino = url.searchParams.get("uddg");
    return destino ? decodeURIComponent(destino) : absoluta;
  } catch {
    return href;
  }
}

const CUPONATION_DIRETA: Record<string, string> = {
  adidas: "https://www.cuponation.com.br/codigo-promocional-adidas",
  samsung: "https://www.cuponation.com.br/cupom-desconto-samsung",
  nike: "https://www.cuponation.com.br/cupom-nike",
  marisa: "https://www.cuponation.com.br/ofertas-marisa",
  amazon: "https://www.cuponation.com.br/cupom-desconto-amazon",
  netshoes: "https://www.cuponation.com.br/cupom-desconto-netshoes",
  centauro: "https://www.cuponation.com.br/cupom-centauro",
  boticario: "https://www.cuponation.com.br/cupom-desconto-boticario",
  "casas-bahia": "https://www.cuponation.com.br/cupom-desconto-casas-bahia",
  sephora: "https://www.cuponation.com.br/desconto-sephora",
  decolar: "https://www.cuponation.com.br/cupom-de-desconto-decolar",
  "beach-park": "https://www.cuponation.com.br/cupom-beach-park",
};

export async function buscarCuponation(loja: LojaBlackFriday) {
  const direta = CUPONATION_DIRETA[loja.slug];
  if (direta) {
    return [{ titulo: `Cupons ${loja.nome}`, url: direta, snippet: "Fonte direta validada." }];
  }

  const query = `site:cuponation.com.br "${loja.nome}" cupom desconto 2026`;
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const resposta = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!resposta.ok && resposta.status !== 202) {
    throw new Error(`Busca respondeu HTTP ${resposta.status}`);
  }

  const html = await resposta.text();
  const $ = load(html);
  const resultados: ResultadoBusca[] = [];

  $("a.result-link").each((_, elemento) => {
    const link = $(elemento);
    const href = link.attr("href") || "";
    const titulo = link.text().replace(/\s+/g, " ").trim();
    const linha = link.closest("tr");
    const snippet = linha.next("tr").find(".result-snippet").text().replace(/\s+/g, " ").trim();
    const destino = urlResultadoDuckDuckGo(href);

    try {
      const parsed = new URL(destino);
      if (!parsed.hostname.toLowerCase().endsWith("cuponation.com.br")) return;
      resultados.push({ titulo, url: destino, snippet });
    } catch {
      // Resultado inválido.
    }
  });

  return resultados.slice(0, 4);
}

function ultimoCampoAntes(texto: string, indice: number, campo: string, limite = 2500) {
  const trecho = texto.slice(Math.max(0, indice - limite), indice);
  const regex = new RegExp(`"${campo}":"([^"]*)"`, "g");
  let valor: string | null = null;
  for (const match of trecho.matchAll(regex)) valor = match[1] ?? null;
  return valor;
}

function ultimoBooleanAntes(texto: string, indice: number, campo: string, limite = 2500) {
  const trecho = texto.slice(Math.max(0, indice - limite), indice);
  const regex = new RegExp(`"${campo}":(true|false)`, "g");
  let valor: boolean | null = null;
  for (const match of trecho.matchAll(regex)) valor = match[1] === "true";
  return valor;
}

function primeiroCampoDepois(texto: string, indice: number, campo: string, limite = 1800) {
  const trecho = texto.slice(indice, Math.min(texto.length, indice + limite));
  const match = trecho.match(new RegExp(`"${campo}":"([^"]*)"`));
  return match?.[1] ?? null;
}

function beneficio(titulo: string, caption1: string, caption2: string) {
  const tudo = `${caption1} ${caption2} ${titulo}`.replace(/\s+/g, " ").trim();

  if (/frete\s+gr[aá]tis/i.test(tudo)) {
    return {
      tipo: "frete_gratis" as const,
      percentual: null,
      valor: null,
      bom: true,
    };
  }

  const percentuais = Array.from(
    tudo.matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*%/g),
    (match) => Number(match[1].replace(",", "."))
  ).filter((valor) => Number.isFinite(valor) && valor > 0 && valor <= 90);

  if (percentuais.length > 0) {
    // Regra conservadora: quando a fonte mistura desconto geral da campanha
    // com desconto extra do cupom, usamos o menor percentual para não inflar
    // o benefício anunciado. Ex.: "60% OFF + cupom de +20%" => 20%.
    const percentual = Math.min(...percentuais);
    return {
      tipo: "percentual" as const,
      percentual,
      valor: null,
      bom: percentual >= 10,
    };
  }

  const valores = Array.from(
    tudo.matchAll(/R\$\s*(\d{1,4}(?:[.,]\d{1,2})?)/gi),
    (match) => Number(match[1].replace(".", "").replace(",", "."))
  ).filter((valor) => Number.isFinite(valor) && valor > 0);

  if (valores.length > 0) {
    const valor = Math.min(...valores);
    return {
      tipo: "valor_fixo" as const,
      percentual: null,
      valor,
      bom: valor >= 20,
    };
  }

  return {
    tipo: "outro" as const,
    percentual: null,
    valor: null,
    bom: false,
  };
}

function codigoAceitavel(codigo: string, loja: LojaBlackFriday) {
  const normalizado = codigo.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{3,23}$/.test(normalizado)) return false;
  if (/-(?:0?1|0?2|0?3)$/.test(normalizado)) return false;

  const proibidos = new Set([
    "CUPOM", "CODIGO", "DESCONTO", "PROMO", "PROMOCAO", "BLACKFRIDAY",
    "SHOPPING", "CALENDAR", "CHECK", "ARROW", "SALE", "STAR",
    "PHONE", "TAG", "CREDIT", "COINS", "MESSAGE",
    loja.nome.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    loja.slug.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  ]);

  return (
    !proibidos.has(normalizado) &&
    !/^(ARROW|SHOPPING|CALENDAR|CHECK|SALE|STAR|PHONE|TAG|CREDIT|COINS|MESSAGE)/.test(normalizado)
  );
}

export async function extrairCuponsCuponation(loja: LojaBlackFriday, fonteUrl: string) {
  const resposta = await fetch(fonteUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!resposta.ok) throw new Error(`Cuponation respondeu HTTP ${resposta.status}`);

  let texto = await resposta.text();
  texto = texto
    .replace(/&quot;/g, '"')
    .replace(/\\\"/g, '"')
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=");

  const agora = Date.now();
  const descobertos = new Map<string, CupomDescoberto>();
  const regexCodigo = /"code":"([^"]{3,30})"/g;

  for (const match of texto.matchAll(regexCodigo)) {
    const bruto = decodeTexto(match[1]).trim();
    if (!codigoAceitavel(bruto, loja)) continue;

    const indice = match.index ?? 0;
    const codigo = bruto.toUpperCase();
    const titulo = decodeTexto(ultimoCampoAntes(texto, indice, "title", 2200)) || `Cupom ${loja.nome}`;
    const caption1 = decodeTexto(ultimoCampoAntes(texto, indice, "caption1", 2200));
    const caption2 = decodeTexto(ultimoCampoAntes(texto, indice, "caption2", 2200));
    const inicio = ultimoCampoAntes(texto, indice, "startTime", 2200) || null;
    const validade = ultimoCampoAntes(texto, indice, "endTime", 2200) || null;
    const publicado = ultimoBooleanAntes(texto, indice, "published", 2200) ?? false;
    const ultimoUso = primeiroCampoDepois(texto, indice, "lastUsedDate", 1500) || null;
    const benef = beneficio(titulo, caption1, caption2);

    const validadeMs = validade ? Date.parse(validade) : Number.NaN;
    const vigente = !validade || (Number.isFinite(validadeMs) && validadeMs > agora);
    const ultimoUsoMs = ultimoUso ? Date.parse(ultimoUso) : Number.NaN;
    const usoRecente =
      Number.isFinite(ultimoUsoMs) &&
      ultimoUsoMs <= agora + 5 * 60_000 &&
      agora - ultimoUsoMs <= 72 * 60 * 60 * 1000;

    const beneficioBom =
      benef.bom ||
      (loja.slug === "decolar" &&
        benef.tipo === "percentual" &&
        (benef.percentual ?? 0) >= 5);

    let score = 5;
    if (publicado) score += 20;
    if (vigente) score += 20;
    if (beneficioBom) score += 20;
    if (usoRecente) score += 35;

    const autoAprovado =
      publicado && vigente && beneficioBom && usoRecente && score >= 95;

    descobertos.set(codigo, {
      codigo,
      titulo,
      tipoDesconto: benef.tipo,
      descontoPercentual: benef.percentual,
      valorDesconto: benef.valor,
      inicio,
      validade,
      ultimoUso,
      publicadoNaFonte: publicado,
      score,
      autoAprovado,
      fonteUrl,
      fonteHost: new URL(fonteUrl).hostname,
      fonteOficial: false,
      fonteNome: "Cuponation",
    });
  }

  return Array.from(descobertos.values()).sort((a, b) => b.score - a.score);
}


const FONTES_OFICIAIS: Record<string, string> = {
  renner: "https://www.lojasrenner.com.br/cupom-de-desconto",
  cea: "https://www.cea.com.br/cupons-de-desconto",
  marisa: "https://www.marisa.com.br/institucional/rules-promotions",
  nike: "https://www.nike.com.br/hotsite/cupom-nike",
  nespresso: "https://www.nespresso.com/br/pt",
  gocase: "https://www.gocase.com.br/degocase",
  decolar: "https://www.decolar.com/black-friday",
  "beach-park": "https://blackfriday.beachpark.com.br/",
};

function dataBrasiliaParaIso(
  dia: string,
  mes: string,
  ano: string,
  hora = "23",
  minuto = "59"
) {
  const valor = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}T${hora.padStart(2, "0")}:${minuto.padStart(2, "0")}:00-03:00`;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data.toISOString() : null;
}

function extrairValidadeOficial(trecho: string) {
  const padroes = [
    /at[eé]\s+(\d{1,2})h(\d{2})\s+(?:\(hor[aá]rio de Bras[ií]lia\)\s+)?do dia\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    /expira\s+em:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+[aà]s\s+(\d{1,2})h(?:(\d{2}))?/i,
  ];

  const primeiro = trecho.match(padroes[0]);
  if (primeiro) {
    return dataBrasiliaParaIso(primeiro[3], primeiro[4], primeiro[5], primeiro[1], primeiro[2]);
  }

  const segundo = trecho.match(padroes[1]);
  if (segundo) {
    return dataBrasiliaParaIso(segundo[1], segundo[2], segundo[3], segundo[4], segundo[5] || "00");
  }

  return null;
}

function extrairInicioOficial(trecho: string) {
  const match = trecho.match(
    /(?:a partir das|de)\s+(\d{1,2})h(\d{2})\s+(?:\(hor[aá]rio de Bras[ií]lia\)\s+)?do dia\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );
  return match
    ? dataBrasiliaParaIso(match[3], match[4], match[5], match[1], match[2])
    : null;
}

function tituloOficial(loja: LojaBlackFriday, codigo: string, benef: ReturnType<typeof beneficio>, contexto: string) {
  const limpo = contexto.replace(/\s+/g, " ").trim();
  const parte = limpo
    .split(/V[aá]lido|Ofertas v[aá]lidas|Promo[cç][aã]o v[aá]lida/i)[0]
    .trim();
  if (parte && parte.length >= 12 && parte.length <= 220) return parte;
  if (benef.tipo === "percentual" && benef.percentual) {
    return `Cupom ${loja.nome} ${codigo}: ${benef.percentual}% OFF`;
  }
  if (benef.tipo === "valor_fixo" && benef.valor) {
    return `Cupom ${loja.nome} ${codigo}: R$ ${benef.valor} OFF`;
  }
  return `Cupom ${loja.nome} ${codigo}`;
}

function beneficioExplicitoDecolar(contexto: string) {
  const trecho = contexto.replace(/\s+/g, " ").trim();

  const percentual = trecho.match(/(?:at[eé]\s+)?(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:OFF|de\s+desconto|menos)/i);
  if (percentual) {
    const valor = Number(percentual[1].replace(",", "."));
    if (Number.isFinite(valor) && valor > 0 && valor <= 90) {
      return {
        tipo: "percentual" as const,
        percentual: valor,
        valor: null,
      };
    }
  }

  const fixo = trecho.match(/(?:at[eé]\s+)?R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:OFF|de\s+desconto|menos|extra)/i);
  if (fixo) {
    const valor = Number(fixo[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(valor) && valor > 0) {
      return {
        tipo: "valor_fixo" as const,
        percentual: null,
        valor,
      };
    }
  }

  return {
    tipo: "outro" as const,
    percentual: null,
    valor: null,
  };
}

async function extrairCuponsDecolarOficial() {
  const fontes = [
    "https://www.decolar.com/black-friday",
    "https://www.decolar.com/black-friday?highlight=azul",
    "https://www.decolar.com/black-friday?highlight=brisa",
    "https://www.decolar.com/black-friday?highlight=sky",
  ];

  const encontrados = new Map<string, CupomDescoberto>();

  for (const fonteUrl of fontes) {
    const resposta = await fetch(fonteUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    if (!resposta.ok) continue;

    const html = await resposta.text();
    const $ = load(html);
    $("script,style,noscript").remove();
    const corpo = $("body").html() || $.root().html() || html;
    const texto = corpo
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#x27;|&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();

    const regex = /(?:cupom\s*:?\s*|aproveite\s+o\s+cupom\s+)([A-Z0-9_-]{4,24})(?=\s|$)/gi;

    for (const match of texto.matchAll(regex)) {
      const codigo = String(match[1] || "").trim().toUpperCase();
      if (!codigoAceitavel(codigo, {
        nome: "Decolar",
        slug: "decolar",
        dominio: "decolar.com",
        homepage: "https://www.decolar.com/",
      })) continue;

      const indice = match.index ?? 0;
      const antes = texto.slice(Math.max(0, indice - 140), indice);
      const benef = beneficioExplicitoDecolar(antes);
      const titulo =
        benef.tipo === "percentual" && benef.percentual
          ? `Cupom Decolar ${codigo}: ${benef.percentual}% OFF`
          : benef.tipo === "valor_fixo" && benef.valor
            ? `Cupom Decolar ${codigo}: R$ ${benef.valor} OFF`
            : `Cupom Decolar ${codigo}`;

      encontrados.set(codigo, {
        codigo,
        titulo,
        tipoDesconto: benef.tipo,
        descontoPercentual: benef.percentual,
        valorDesconto: benef.valor,
        inicio: null,
        validade: null,
        ultimoUso: null,
        publicadoNaFonte: true,
        score: 100,
        autoAprovado: true,
        fonteUrl,
        fonteHost: "www.decolar.com",
        fonteOficial: true,
        fonteNome: "Decolar oficial",
      });
    }
  }

  return Array.from(encontrados.values());
}

export async function extrairCuponsFonteOficial(loja: LojaBlackFriday) {
  if (loja.slug === "decolar") {
    return extrairCuponsDecolarOficial();
  }

  const fonteUrl = FONTES_OFICIAIS[loja.slug];
  if (!fonteUrl) return [] as CupomDescoberto[];

  const resposta = await fetch(fonteUrl, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!resposta.ok) throw new Error(`Fonte oficial respondeu HTTP ${resposta.status}`);

  const html = await resposta.text();
  const $ = load(html);
  const texto = $.root().text().replace(/\s+/g, " ").trim();
  const agora = Date.now();
  const encontrados = new Map<string, CupomDescoberto>();
  const regex = /(?:cupom\s*[:\-]?\s*|use\s+o\s+cupom\s*[:\-]?\s*)(?:["“”']?)([A-Z0-9_-]{4,24})(?:["“”']?)/gi;

  for (const match of texto.matchAll(regex)) {
    const codigo = String(match[1] || "").trim().toUpperCase();
    if (!codigoAceitavel(codigo, loja)) continue;

    const indice = match.index ?? 0;
    const contexto = texto.slice(Math.max(0, indice - 220), Math.min(texto.length, indice + 420));
    const benef = beneficio(contexto, "", "");
    const validade = extrairValidadeOficial(contexto);
    const inicio = extrairInicioOficial(contexto);
    const validadeMs = validade ? Date.parse(validade) : Number.NaN;
    const vigente = !validade || (Number.isFinite(validadeMs) && validadeMs > agora);

    // Fonte oficial vale como confirmação forte. Ainda exigimos benefício relevante.
    const autoAprovado = vigente && benef.bom;
    const score = (vigente ? 35 : 0) + (benef.bom ? 35 : 0) + 30;

    encontrados.set(codigo, {
      codigo,
      titulo: tituloOficial(loja, codigo, benef, contexto),
      tipoDesconto: benef.tipo,
      descontoPercentual: benef.percentual,
      valorDesconto: benef.valor,
      inicio,
      validade,
      ultimoUso: null,
      publicadoNaFonte: true,
      score,
      autoAprovado,
      fonteUrl,
      fonteHost: new URL(fonteUrl).hostname,
      fonteOficial: true,
      fonteNome: `${loja.nome} oficial`,
    });
  }

  return Array.from(encontrados.values()).sort((a, b) => b.score - a.score);
}

async function garantirLoja(loja: LojaBlackFriday) {
  const { data: existente, error } = await supabaseAdmin
    .from("economize_lojas")
    .select("id,nome,slug,dominio,ativa")
    .eq("slug", loja.slug)
    .maybeSingle();

  if (error) throw new Error(`Falha ao consultar loja ${loja.nome}: ${error.message}`);
  if (existente) return existente;

  const { data: criada, error: erroCriacao } = await supabaseAdmin
    .from("economize_lojas")
    .insert({
      nome: loja.nome,
      slug: loja.slug,
      dominio: loja.dominio,
      ativa: true,
      ordem: 900,
      segmento: "varejo",
    })
    .select("id,nome,slug,dominio,ativa")
    .single();

  if (erroCriacao || !criada) {
    throw new Error(`Falha ao criar loja ${loja.nome}: ${erroCriacao?.message || "erro desconhecido"}`);
  }
  return criada;
}

async function lojaTemAutomacaoDeCupons(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("afiliados_parceiros")
    .select("status,automacao_status,integracoes")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return false;
  const integracoes = Array.isArray(data.integracoes) ? data.integracoes.map(String) : [];
  return data.automacao_status === "ativa" && integracoes.some((item) => item.toLowerCase().includes("cupom"));
}

function validadeOperacional(cupom: CupomDescoberto) {
  const limiteSemValidade = Date.now() + 24 * 60 * 60 * 1000;
  if (!cupom.validade) return new Date(limiteSemValidade).toISOString();

  const fonteMs = Date.parse(cupom.validade);
  if (!Number.isFinite(fonteMs)) return new Date(limiteSemValidade).toISOString();
  return new Date(Math.min(fonteMs, Date.now() + 7 * 24 * 60 * 60 * 1000)).toISOString();
}

export async function salvarCupomBlackFriday(lojaDef: LojaBlackFriday, cupom: CupomDescoberto) {
  const loja = await garantirLoja(lojaDef);
  const agora = new Date().toISOString();

  const { data: codigoExistente, error: erroCodigoExistente } = await supabaseAdmin
    .from("economize_cupons")
    .select("id,origem,dedupe_key,status")
    .eq("loja_id", loja.id)
    .eq("codigo", cupom.codigo)
    .maybeSingle();

  if (erroCodigoExistente) throw new Error(erroCodigoExistente.message);

  const nossoDedupe = `bf2026:${lojaDef.slug}:${cupom.codigo}`;
  if (codigoExistente && codigoExistente.dedupe_key !== nossoDedupe) {
    return {
      cupomId: codigoExistente.id,
      ofertaId: null,
      status: codigoExistente.status || "existente",
      ignoradoDuplicado: true,
      origemExistente: codigoExistente.origem || null,
    };
  }
  const status = cupom.autoAprovado ? "ativo" : "pendente";
  const validade = validadeOperacional(cupom);
  const dedupe = `bf2026:${lojaDef.slug}:${cupom.codigo}`;
  const linkAfiliado = lojaDef.slug === "amazon"
    ? "https://www.amazon.com.br/?tag=achadosdoca03-20"
    : null;
  const dadosBrutos = {
    campanha: "black-friday-2026",
    black_friday_trafego: true,
    sem_afiliado: !linkAfiliado,
    ...(linkAfiliado ? {
      afiliado_configurado: true,
      affiliate_program: "Amazon Associados Brasil",
      affiliate_store_id: "achadosdoca03-20",
      affiliate_url: linkAfiliado,
    } : {}),
    fonte_confiavel: cupom.fonteNome || (cupom.fonteOficial ? "fonte_oficial" : "cuponation"),
    fonte_oficial: Boolean(cupom.fonteOficial),
    fonte_url: cupom.fonteUrl,
    fonte_host: cupom.fonteHost,
    fonte_publicado: cupom.publicadoNaFonte,
    ultimo_uso_registrado: cupom.ultimoUso,
    score_qualidade: cupom.score,
    auto_aprovado: cupom.autoAprovado,
    regra_auto_aprovacao: cupom.fonteOficial
      ? "fonte_oficial+vigente+beneficio_bom"
      : "publicado+vigente+beneficio_bom+uso_ultimas_72h",
  };

  const { data: cupomExistente, error: erroBuscaCupom } = await supabaseAdmin
    .from("economize_cupons")
    .select("id")
    .eq("dedupe_key", dedupe)
    .maybeSingle();
  if (erroBuscaCupom) throw new Error(erroBuscaCupom.message);

  const cupomPayload = {
    loja_id: loja.id,
    status,
    codigo: cupom.codigo,
    titulo: cupom.titulo,
    descricao: cupom.fonteOficial
      ? `Cupom ${lojaDef.nome} confirmado diretamente em fonte oficial da loja.`
      : `Cupom ${lojaDef.nome} encontrado pelo Radar de Cupons e verificado em fonte pública com registro de uso recente.`,
    regras: "Confira as condições finais no carrinho da loja. Cupom monitorado e revalidado automaticamente.",
    tipo_desconto: cupom.tipoDesconto,
    desconto_percentual: cupom.descontoPercentual,
    valor_desconto: cupom.valorDesconto,
    data_inicio: cupom.inicio,
    validade,
    link_destino: lojaDef.homepage,
    link_afiliado: linkAfiliado,
    origem: BLACK_FRIDAY_ORIGEM,
    origem_url: cupom.fonteUrl,
    dedupe_key: dedupe,
    dados_brutos: dadosBrutos,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  let cupomId: string;
  if (cupomExistente?.id) {
    const { data, error } = await supabaseAdmin
      .from("economize_cupons")
      .update(cupomPayload)
      .eq("id", cupomExistente.id)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao atualizar cupom");
    cupomId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("economize_cupons")
      .insert(cupomPayload)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao criar cupom");
    cupomId = data.id;
  }

  const ofertaPayload = {
    loja_id: loja.id,
    tipo: "cupom",
    status,
    titulo: cupom.titulo,
    descricao: cupom.fonteOficial
      ? `Código ${cupom.codigo} confirmado na fonte oficial da ${lojaDef.nome}.`
      : `Código ${cupom.codigo} com uso recente registrado. Confira as condições na ${lojaDef.nome}.`,
    codigo: cupom.codigo,
    categoria: Date.now() < Date.parse(BLACK_FRIDAY_FIM) ? "Black Friday" : "Cupons",
    regras: "Confira elegibilidade e condições no carrinho da loja.",
    imagem_url: null,
    link_destino: lojaDef.homepage,
    link_afiliado: linkAfiliado,
    desconto_percentual: cupom.descontoPercentual,
    valor_desconto: cupom.valorDesconto,
    data_inicio: cupom.inicio,
    validade,
    destaque: (cupom.descontoPercentual ?? 0) >= 20 || (cupom.valorDesconto ?? 0) >= 50,
    selos: Date.now() < Date.parse(BLACK_FRIDAY_FIM) ? ["BLACK FRIDAY", "VERIFICADO", "TRÁFEGO"] : ["CUPOM", "VERIFICADO", "TRÁFEGO"],
    origem: BLACK_FRIDAY_ORIGEM,
    origem_url: cupom.fonteUrl,
    dedupe_key: dedupe,
    dados_brutos: dadosBrutos,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  const { data: ofertaExistente, error: erroBuscaOferta } = await supabaseAdmin
    .from("economize_ofertas")
    .select("id")
    .eq("dedupe_key", dedupe)
    .maybeSingle();
  if (erroBuscaOferta) throw new Error(erroBuscaOferta.message);

  let ofertaId: string;
  if (ofertaExistente?.id) {
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .update(ofertaPayload)
      .eq("id", ofertaExistente.id)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao atualizar oferta");
    ofertaId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .insert(ofertaPayload)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao criar oferta");
    ofertaId = data.id;
  }

  const { error: erroVinculo } = await supabaseAdmin
    .from("economize_cupons_ofertas")
    .upsert(
      { cupom_id: cupomId, oferta_id: ofertaId, aplicacao: "possivel", observacao: "Radar Black Friday 2026" },
      { onConflict: "cupom_id,oferta_id" }
    );
  if (erroVinculo) {
    // Bancos antigos podem não expor o índice composto ao upsert; tenta insert simples.
    const { error: insertErro } = await supabaseAdmin
      .from("economize_cupons_ofertas")
      .insert({ cupom_id: cupomId, oferta_id: ofertaId, aplicacao: "possivel", observacao: "Radar Black Friday 2026" });
    if (insertErro && insertErro.code !== "23505") throw new Error(insertErro.message);
  }

  return { cupomId, ofertaId, status };
}

export async function desativarNaoEncontrados(lojaId: string, dedupesEncontrados: string[]) {
  const { data: atuais, error } = await supabaseAdmin
    .from("economize_ofertas")
    .select("id,dedupe_key")
    .eq("loja_id", lojaId)
    .eq("origem", BLACK_FRIDAY_ORIGEM)
    .in("status", ["ativo", "pendente"]);
  if (error) throw new Error(error.message);

  const encontrados = new Set(dedupesEncontrados);
  const ausentes = (atuais ?? []).filter((item) => item.dedupe_key && !encontrados.has(item.dedupe_key));
  if (ausentes.length === 0) return 0;

  const dedupes = ausentes.map((item) => item.dedupe_key).filter(Boolean) as string[];
  const agora = new Date().toISOString();

  await supabaseAdmin
    .from("economize_ofertas")
    .update({ status: "inativo", updated_at: agora })
    .eq("loja_id", lojaId)
    .eq("origem", BLACK_FRIDAY_ORIGEM)
    .in("dedupe_key", dedupes);

  await supabaseAdmin
    .from("economize_cupons")
    .update({ status: "inativo", updated_at: agora })
    .eq("loja_id", lojaId)
    .eq("origem", BLACK_FRIDAY_ORIGEM)
    .in("dedupe_key", dedupes);

  return dedupes.length;
}

export async function processarLojaBlackFriday(lojaDef: LojaBlackFriday) {
  const possuiFonteOficial = Boolean(FONTES_OFICIAIS[lojaDef.slug]);
  if ((await lojaTemAutomacaoDeCupons(lojaDef.slug)) && !possuiFonteOficial) {
    return {
      loja: lojaDef.slug,
      ignorada: true,
      motivo: "Loja já possui automação de cupons ativa; evita duplicação.",
      encontrados: 0,
      ativos: 0,
      pendentes: 0,
      desativados: 0,
      fonte: null,
    };
  }

  const oficiais = await extrairCuponsFonteOficial(lojaDef);
  let cupons = oficiais;
  let fonte = oficiais[0]?.fonteUrl || null;

  if (lojaDef.slug === "decolar") {
    // Para a Decolar, combinamos a página oficial com a fonte pública
    // verificada. A página oficial confirma códigos destacados, enquanto
    // a Cuponation expõe um conjunto maior com validade e uso recente.
    const resultados = await buscarCuponation(lojaDef);
    const fonteCuponation = resultados[0]?.url || null;
    const externos = fonteCuponation
      ? await extrairCuponsCuponation(lojaDef, fonteCuponation)
      : [];
    const agora = Date.now();
    const vigentes = externos.filter((cupom) => {
      if (!cupom.validade) return true;
      const validade = Date.parse(cupom.validade);
      return Number.isFinite(validade) && validade > agora;
    });

    const porCodigo = new Map<string, CupomDescoberto>();
    for (const cupom of vigentes) porCodigo.set(cupom.codigo, cupom);
    // Se o mesmo código aparecer nas duas fontes, a confirmação oficial vence.
    for (const cupom of oficiais) porCodigo.set(cupom.codigo, cupom);

    cupons = Array.from(porCodigo.values()).sort((a, b) => b.score - a.score);
    fonte = oficiais[0]?.fonteUrl || fonteCuponation;
  } else if (cupons.length === 0) {
    const resultados = await buscarCuponation(lojaDef);
    fonte = resultados[0]?.url || null;
    if (fonte) {
      cupons = await extrairCuponsCuponation(lojaDef, fonte);
    }
  }

  if (!fonte || cupons.length === 0) {
    return {
      loja: lojaDef.slug,
      ignorada: false,
      motivo: "Nenhum cupom verificável encontrado nas fontes prioritárias.",
      encontrados: 0,
      ativos: 0,
      pendentes: 0,
      desativados: 0,
      fonte: fonte || null,
    };
  }
  const loja = await garantirLoja(lojaDef);
  const dedupes: string[] = [];
  let ativos = 0;
  let pendentes = 0;

  const limiteCupons = lojaDef.slug === "decolar" ? 40 : 20;
  for (const cupom of cupons.slice(0, limiteCupons)) {
    const salvo = await salvarCupomBlackFriday(lojaDef, cupom);
    dedupes.push(`bf2026:${lojaDef.slug}:${cupom.codigo}`);
    if ((salvo as any).ignoradoDuplicado) continue;
    if (salvo.status === "ativo") ativos += 1;
    else pendentes += 1;
  }

  const desativados = await desativarNaoEncontrados(loja.id, dedupes);

  return {
    loja: lojaDef.slug,
    ignorada: false,
    motivo: null,
    encontrados: cupons.length,
    ativos,
    pendentes,
    desativados,
    fonte,
  };
}
