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

export async function buscarCuponation(loja: LojaBlackFriday) {
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

  const percentualMatch = tudo.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (percentualMatch) {
    const percentual = Number(percentualMatch[1].replace(",", "."));
    return {
      tipo: "percentual" as const,
      percentual,
      valor: null,
      bom: percentual >= 10,
    };
  }

  const valorMatch = tudo.match(/R\$\s*(\d{1,4}(?:[.,]\d{1,2})?)/i);
  if (valorMatch) {
    const valor = Number(valorMatch[1].replace(".", "").replace(",", "."));
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
    loja.nome.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    loja.slug.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  ]);

  return !proibidos.has(normalizado) && !/^(ARROW|SHOPPING|CALENDAR|CHECK|SALE|STAR)/.test(normalizado);
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

    let score = 5;
    if (publicado) score += 20;
    if (vigente) score += 20;
    if (benef.bom) score += 20;
    if (usoRecente) score += 35;

    const autoAprovado = publicado && vigente && benef.bom && usoRecente && score >= 95;

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
    });
  }

  return Array.from(descobertos.values()).sort((a, b) => b.score - a.score);
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
  const status = cupom.autoAprovado ? "ativo" : "pendente";
  const validade = validadeOperacional(cupom);
  const dedupe = `bf2026:${lojaDef.slug}:${cupom.codigo}`;
  const dadosBrutos = {
    campanha: "black-friday-2026",
    black_friday_trafego: true,
    sem_afiliado: true,
    fonte_confiavel: "cuponation",
    fonte_url: cupom.fonteUrl,
    fonte_host: cupom.fonteHost,
    fonte_publicado: cupom.publicadoNaFonte,
    ultimo_uso_registrado: cupom.ultimoUso,
    score_qualidade: cupom.score,
    auto_aprovado: cupom.autoAprovado,
    regra_auto_aprovacao: "publicado+vigente+beneficio_bom+uso_ultimas_72h",
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
    descricao: `Cupom ${lojaDef.nome} encontrado pelo Radar Black Friday e verificado em fonte pública com registro de uso recente.`,
    regras: "Confira as condições finais no carrinho da loja. Cupom monitorado durante a Black Friday.",
    tipo_desconto: cupom.tipoDesconto,
    desconto_percentual: cupom.descontoPercentual,
    valor_desconto: cupom.valorDesconto,
    data_inicio: cupom.inicio,
    validade,
    link_destino: lojaDef.homepage,
    link_afiliado: null,
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
    descricao: `Código ${cupom.codigo} com uso recente registrado. Confira as condições na ${lojaDef.nome}.`,
    codigo: cupom.codigo,
    categoria: "Black Friday",
    regras: "Confira elegibilidade e condições no carrinho da loja.",
    imagem_url: null,
    link_destino: lojaDef.homepage,
    link_afiliado: null,
    desconto_percentual: cupom.descontoPercentual,
    valor_desconto: cupom.valorDesconto,
    data_inicio: cupom.inicio,
    validade,
    destaque: (cupom.descontoPercentual ?? 0) >= 20 || (cupom.valorDesconto ?? 0) >= 50,
    selos: ["BLACK FRIDAY", "VERIFICADO", "TRÁFEGO"],
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
  if (await lojaTemAutomacaoDeCupons(lojaDef.slug)) {
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

  const resultados = await buscarCuponation(lojaDef);
  const fonte = resultados[0]?.url || null;
  if (!fonte) {
    return {
      loja: lojaDef.slug,
      ignorada: false,
      motivo: "Nenhuma página Cuponation encontrada pela busca.",
      encontrados: 0,
      ativos: 0,
      pendentes: 0,
      desativados: 0,
      fonte: null,
    };
  }

  const cupons = await extrairCuponsCuponation(lojaDef, fonte);
  const loja = await garantirLoja(lojaDef);
  const dedupes: string[] = [];
  let ativos = 0;
  let pendentes = 0;

  for (const cupom of cupons.slice(0, 20)) {
    const salvo = await salvarCupomBlackFriday(lojaDef, cupom);
    dedupes.push(`bf2026:${lojaDef.slug}:${cupom.codigo}`);
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
