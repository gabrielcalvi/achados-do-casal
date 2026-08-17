const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { createGunzip } = require("zlib");
const { createClient } = require("@supabase/supabase-js");
const lojasConfig = require("./awin-lojas.config.cjs");

const CONFIRMAR = process.argv.includes("CONFIRMAR");
const PUBLISHER_ID = String(process.env.AWIN_PUBLISHER_ID || "2922231").trim();
const AWIN_API_TOKEN = String(process.env.AWIN_API_TOKEN || "").trim();
const DATAFEED_KEY = String(process.env.AWIN_DATAFEED_API_KEY || "").trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const LIMITE_POR_LOJA = Math.max(1, Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15)));
const DESCONTO_MINIMO = Math.max(1, Math.min(90, Number(process.env.AWIN_PRODUTOS_DESCONTO_MINIMO || 10)));
const STATUS_FILE = "/vercel/tmp/awin-produtos-status.json";
const RESULT_FILE = "/vercel/tmp/awin-produtos-resultado.json";

if (!AWIN_API_TOKEN) throw new Error("AWIN_API_TOKEN ausente.");
if (!DATAFEED_KEY) throw new Error("AWIN_DATAFEED_API_KEY ausente.");
if (!supabaseUrl || !serviceKey) throw new Error("Credenciais Supabase ausentes.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const lojas = lojasConfig.filter(
  (loja) =>
    !loja.monitorOnly &&
    ["cea", "renner", "calvin-klein", "stanley", "casas-bahia"].includes(loja.slug)
);

function agora() {
  return new Date().toISOString();
}

function salvarStatus(dados) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(
    STATUS_FILE,
    JSON.stringify({ atualizadoEm: agora(), ...dados }, null, 2),
    "utf8"
  );
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function chaveCabecalho(valor) {
  return texto(valor)
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvCompleto(conteudo, delimitador = ",") {
  const linhas = [];
  let linha = [];
  let campo = "";
  let emAspas = false;
  let aposAspa = false;

  function fecharCampo() {
    linha.push(campo);
    campo = "";
  }

  function fecharLinha() {
    fecharCampo();
    if (linha.some((valor) => texto(valor))) linhas.push(linha);
    linha = [];
  }

  for (let i = 0; i < conteudo.length; i += 1) {
    const char = conteudo[i];

    if (emAspas) {
      if (char === '"') {
        emAspas = false;
        aposAspa = true;
      } else {
        campo += char;
      }
      continue;
    }

    if (aposAspa) {
      if (char === '"') {
        campo += '"';
        emAspas = true;
        aposAspa = false;
        continue;
      }
      aposAspa = false;
    }

    if (char === '"' && campo.length === 0) {
      emAspas = true;
    } else if (char === delimitador) {
      fecharCampo();
    } else if (char === "\n") {
      fecharLinha();
    } else if (char !== "\r") {
      campo += char;
    }
  }

  if (campo.length || linha.length) fecharLinha();
  if (!linhas.length) return [];

  const cabecalhos = linhas[0].map(chaveCabecalho);
  return linhas.slice(1).map((valores) => {
    const obj = {};
    for (let i = 0; i < cabecalhos.length; i += 1) {
      if (cabecalhos[i]) obj[cabecalhos[i]] = valores[i] ?? "";
    }
    return obj;
  });
}

function campo(obj, nomes) {
  for (const nome of nomes) {
    const valor = obj[chaveCabecalho(nome)];
    if (valor !== undefined && texto(valor)) return valor;
  }
  return "";
}

function parsePreco(valor, moedaPadrao = "BRL") {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return { valor, moeda: moedaPadrao };
  }

  const s = texto(valor).replace(/\s+/g, " ");
  const moeda = (s.match(/\b([A-Z]{3})\b/i)?.[1] || moedaPadrao || "BRL").toUpperCase();
  let numero = s.replace(/[^0-9,.-]/g, "");

  if (numero.includes(",") && numero.includes(".")) {
    if (numero.lastIndexOf(",") > numero.lastIndexOf(".")) {
      numero = numero.replace(/\./g, "").replace(",", ".");
    } else {
      numero = numero.replace(/,/g, "");
    }
  } else if (numero.includes(",")) {
    numero = numero.replace(",", ".");
  }

  const n = Number(numero);
  return Number.isFinite(n) && n > 0 ? { valor: n, moeda } : null;
}

function numero(valor) {
  const n = Number(texto(valor).replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function urlValida(valor, dominio) {
  try {
    const url = new URL(texto(valor));
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const esperado = dominio.toLowerCase().replace(/^www\./, "");
    if (!host.endsWith(esperado)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function imagemValida(valor) {
  try {
    const url = new URL(texto(valor));
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

function trackingValido(urlOriginal, loja) {
  const url = texto(urlOriginal);
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const mid = parsed.searchParams.get("awinmid");
    const aff = parsed.searchParams.get("awinaffid");
    if (mid === String(loja.advertiserId) && aff === PUBLISHER_ID) return true;
  } catch {}

  return (
    url.includes(`awinmid=${loja.advertiserId}`) &&
    url.includes(`awinaffid=${PUBLISHER_ID}`)
  );
}

function valorFalso(valor) {
  const normalizado = texto(valor).toLowerCase();
  return ["0", "false", "no", "nao", "não", "out of stock", "out_of_stock", "unavailable"].includes(normalizado);
}

function dataAtiva(inicio, fim) {
  const inicioMs = Date.parse(texto(inicio));
  const fimMs = Date.parse(texto(fim));
  const agoraMs = Date.now();

  if (Number.isFinite(inicioMs) && inicioMs > agoraMs) return false;
  if (Number.isFinite(fimMs) && fimMs <= agoraMs) return false;
  return true;
}

function normalizarProdutoLegacy(row, loja) {
  const id = texto(campo(row, ["aw_product_id", "merchant_product_id", "product_id"]));
  const titulo = texto(campo(row, ["product_name", "name", "title"]));
  const descricao = texto(campo(row, ["description", "product_short_description"]));
  const link = urlValida(campo(row, ["merchant_deep_link", "merchant_link", "product_url"]), loja.dominio);
  const linkAfiliado = texto(campo(row, ["aw_deep_link", "awin_deep_link"]));
  const imagem = imagemValida(campo(row, ["merchant_image_url", "large_image", "aw_image_url", "merchant_thumb_url"]));
  const moeda = texto(campo(row, ["currency", "moeda"])) || "BRL";
  const inStock = campo(row, ["in_stock", "stock_status", "availability"]);
  const isForSale = campo(row, ["is_for_sale", "web_offer"]);
  const inicio = campo(row, ["valid_from"]);
  const fim = campo(row, ["valid_to"]);
  const categoria = texto(campo(row, ["merchant_product_category_path", "merchant_category", "category_name"]));
  const marca = texto(campo(row, ["brand_name", "brand"]));

  if (!id || !titulo || !link || !imagem) return null;
  if (inStock && valorFalso(inStock)) return null;
  if (isForSale && valorFalso(isForSale)) return null;
  if (!dataAtiva(inicio, fim)) return null;

  const precoAtual = parsePreco(
    campo(row, ["search_price", "store_price", "base_price", "price"]),
    moeda
  );

  let precoOriginal = parsePreco(
    campo(row, ["rrp_price", "product_price_old", "old_price", "was_price"]),
    moeda
  );

  const economiaInformada = parsePreco(campo(row, ["saving", "savings"]), moeda);
  const percentualInformado = numero(campo(row, ["savings_percent", "saving_percent", "discount_percent"]));

  if (!precoAtual || precoAtual.moeda !== "BRL") return null;

  if (!precoOriginal && economiaInformada && economiaInformada.valor > 0) {
    precoOriginal = { valor: precoAtual.valor + economiaInformada.valor, moeda: "BRL" };
  }

  if (
    !precoOriginal &&
    percentualInformado !== null &&
    percentualInformado > 0 &&
    percentualInformado < 100
  ) {
    precoOriginal = {
      valor: precoAtual.valor / (1 - percentualInformado / 100),
      moeda: "BRL",
    };
  }

  if (!precoOriginal || precoOriginal.moeda !== "BRL") return null;
  if (precoAtual.valor >= precoOriginal.valor) return null;

  const economia = precoOriginal.valor - precoAtual.valor;
  const percentual = Math.round((economia / precoOriginal.valor) * 1000) / 10;
  if (percentual < DESCONTO_MINIMO) return null;

  return {
    id,
    titulo,
    descricao,
    link,
    linkAfiliado: trackingValido(linkAfiliado, loja) ? linkAfiliado : null,
    imagem,
    categoria: categoria || null,
    marca: marca || null,
    precoOriginal: Math.round(precoOriginal.valor * 100) / 100,
    precoOferta: Math.round(precoAtual.valor * 100) / 100,
    economia: Math.round(economia * 100) / 100,
    percentual,
    validade: fim || null,
    fonte: "awin_legacy_product_feed",
  };
}

function chaveSimilar(produto) {
  return `${produto.marca || ""}|${produto.titulo}`
    .toLowerCase()
    .replace(/\b(tam|tamanho|size|cor|color)\b[^|,;]*/g, "")
    .replace(/[^a-z0-9áàâãéêíóôõúç]+/gi, " ")
    .trim()
    .slice(0, 160);
}

function ordenarProdutos(a, b) {
  return b.percentual - a.percentual || b.economia - a.economia || a.precoOferta - b.precoOferta;
}

function inserirTop(lista, produto) {
  const chave = chaveSimilar(produto);
  const existente = lista.findIndex((item) => chaveSimilar(item) === chave);

  if (existente >= 0) {
    const atual = lista[existente];
    if (ordenarProdutos(produto, atual) < 0) lista[existente] = produto;
  } else {
    lista.push(produto);
  }

  lista.sort(ordenarProdutos);
  if (lista.length > LIMITE_POR_LOJA * 5) lista.length = LIMITE_POR_LOJA * 5;
}

async function buscarListaFeeds() {
  const endpoint = `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(DATAFEED_KEY)}`;
  const resposta = await fetch(endpoint, {
    headers: { Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(60000),
  });

  const conteudo = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`Lista de feeds AWIN HTTP ${resposta.status}: ${conteudo.slice(0, 160)}`);
  }

  const linhas = parseCsvCompleto(conteudo, ",");
  if (!linhas.length) throw new Error("Lista de feeds AWIN vazia ou inválida.");
  return linhas;
}

function feedsDaLoja(lista, loja) {
  const id = String(loja.advertiserId);
  let encontrados = lista.filter((row) => texto(campo(row, ["Advertiser ID", "advertiser_id"])) === id);

  encontrados = encontrados.filter((row) => {
    const status = texto(campo(row, ["Membership Status", "membership_status"])).toLowerCase();
    return !status || status.includes("joined") || status.includes("aprov");
  });

  encontrados = encontrados.filter((row) => {
    const url = texto(campo(row, ["URL", "download_url"]));
    return /\/datafeed\/download\/apikey\//i.test(url);
  });

  const ptBr = encontrados.filter((row) => {
    const idioma = texto(campo(row, ["Language", "language"])).toLowerCase();
    const regiao = texto(campo(row, ["Primary Region", "primary_region"])).toLowerCase();
    const portugues = idioma.includes("portugu") || /(^|[^a-z])pt([^a-z]|$)/.test(idioma);
    const brasil = regiao === "br" || regiao.includes("brazil") || regiao.includes("brasil");
    return portugues && brasil;
  });

  if (ptBr.length) return ptBr;

  const brasil = encontrados.filter((row) => {
    const regiao = texto(campo(row, ["Primary Region", "primary_region"])).toLowerCase();
    return regiao === "br" || regiao.includes("brazil") || regiao.includes("brasil");
  });

  if (brasil.length) return brasil;
  return encontrados;
}

function delimitadorDaUrl(urlOriginal) {
  const match = texto(urlOriginal).match(/\/delimiter\/([^/]+)/i);
  if (!match) return ",";

  try {
    const valor = decodeURIComponent(match[1]);
    return valor.length === 1 ? valor : ",";
  } catch {
    return ",";
  }
}

async function streamPossivelmenteGzip(resposta) {
  if (!resposta.body) throw new Error("Feed AWIN sem corpo de resposta.");

  const origem = Readable.fromWeb(resposta.body);
  const iterator = origem[Symbol.asyncIterator]();
  const primeiro = await iterator.next();

  async function* recomposto() {
    if (!primeiro.done && primeiro.value) yield primeiro.value;
    while (true) {
      const proximo = await iterator.next();
      if (proximo.done) break;
      yield proximo.value;
    }
  }

  const stream = Readable.from(recomposto());
  const bytes = primeiro.value || Buffer.alloc(0);
  const ehGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  return ehGzip ? stream.pipe(createGunzip()) : stream;
}

async function lerCsvStreaming(stream, delimitador, onRow) {
  const decoder = new TextDecoder("utf-8");
  let cabecalhos = null;
  let linha = [];
  let valor = "";
  let emAspas = false;
  let aposAspa = false;

  function fecharCampo() {
    linha.push(valor);
    valor = "";
  }

  function emitirLinha() {
    fecharCampo();
    if (!linha.some((campoAtual) => texto(campoAtual))) {
      linha = [];
      return;
    }

    if (!cabecalhos) {
      cabecalhos = linha.map(chaveCabecalho);
    } else {
      const obj = {};
      for (let i = 0; i < cabecalhos.length; i += 1) {
        if (cabecalhos[i]) obj[cabecalhos[i]] = linha[i] ?? "";
      }
      onRow(obj);
    }

    linha = [];
  }

  function processar(textoChunk) {
    for (let i = 0; i < textoChunk.length; i += 1) {
      const char = textoChunk[i];

      if (emAspas) {
        if (char === '"') {
          emAspas = false;
          aposAspa = true;
        } else {
          valor += char;
        }
        continue;
      }

      if (aposAspa) {
        if (char === '"') {
          valor += '"';
          emAspas = true;
          aposAspa = false;
          continue;
        }
        aposAspa = false;
      }

      if (char === '"' && valor.length === 0) {
        emAspas = true;
      } else if (char === delimitador) {
        fecharCampo();
      } else if (char === "\n") {
        emitirLinha();
      } else if (char !== "\r") {
        valor += char;
      }
    }
  }

  for await (const chunk of stream) {
    processar(decoder.decode(chunk, { stream: true }));
  }

  processar(decoder.decode());
  if (valor.length || linha.length) emitirLinha();
}

async function lerFeedLegacy(loja, feeds) {
  if (!feeds.length) {
    return {
      disponivel: false,
      motivo: "feed_legacy_nao_encontrado_para_anunciante",
      total: 0,
      elegiveis: 0,
      selecionados: [],
      feedsLidos: 0,
    };
  }

  let total = 0;
  let elegiveis = 0;
  let feedsLidos = 0;
  const top = [];

  for (const feed of feeds) {
    const url = texto(campo(feed, ["URL", "download_url"]));
    const feedId = texto(campo(feed, ["Feed ID", "feed_id"]));
    const feedNome = texto(campo(feed, ["Feed Name", "feed_name"]));
    if (!url) continue;

    console.log(`Lendo feed legacy ${loja.slug} | feed=${feedId || "?"} | ${feedNome || "Default"}`);

    const resposta = await fetch(url, {
      headers: { Accept: "text/csv,application/gzip,application/octet-stream,*/*" },
      signal: AbortSignal.timeout(240000),
    });

    if (!resposta.ok || !resposta.body) {
      const corpo = await resposta.text().catch(() => "");
      console.warn(`Feed legacy ${loja.slug}/${feedId || "?"} HTTP ${resposta.status}: ${corpo.slice(0, 120)}`);
      continue;
    }

    const stream = await streamPossivelmenteGzip(resposta);
    const delimitador = delimitadorDaUrl(url);
    feedsLidos += 1;

    await lerCsvStreaming(stream, delimitador, (row) => {
      total += 1;
      const produto = normalizarProdutoLegacy(row, loja);
      if (!produto) return;
      elegiveis += 1;
      inserirTop(top, produto);
    });
  }

  return {
    disponivel: feedsLidos > 0,
    motivo: feedsLidos > 0 ? null : "feeds_legacy_falharam_download",
    total,
    elegiveis,
    selecionados: top.slice(0, LIMITE_POR_LOJA),
    feedsLidos,
  };
}

async function gerarLinksAfiliados(loja, produtos) {
  const prontos = produtos.filter((produto) => trackingValido(produto.linkAfiliado, loja));
  const pendentes = produtos.filter((produto) => !trackingValido(produto.linkAfiliado, loja));

  if (!pendentes.length) {
    return { produtos: prontos.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA), falhas: 0, nativos: prontos.length };
  }

  const endpoint = `https://api.awin.com/publishers/${encodeURIComponent(PUBLISHER_ID)}/linkbuilder/generate-batch?accessToken=${encodeURIComponent(AWIN_API_TOKEN)}`;
  const resposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AWIN_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      requests: pendentes.map((produto) => ({
        advertiserId: Number(loja.advertiserId),
        destinationUrl: produto.link,
        parameters: { campaign: "achados-economize-produtos" },
      })),
    }),
    signal: AbortSignal.timeout(60000),
  });

  const corpo = await resposta.text();
  let json;
  try {
    json = JSON.parse(corpo);
  } catch {
    throw new Error(`Link Builder ${loja.slug} respondeu JSON inválido.`);
  }

  if (!resposta.ok) {
    throw new Error(`Link Builder ${loja.slug} HTTP ${resposta.status}: ${corpo.slice(0, 180)}`);
  }

  const responses = Array.isArray(json.responses) ? json.responses : [];
  const gerados = [];
  let falhas = 0;

  for (let i = 0; i < pendentes.length; i += 1) {
    const item = responses[i];
    const url = texto(item?.body?.url || item?.body?.trackingUrl || item?.url);
    if (Number(item?.status || 0) !== 200 || !trackingValido(url, loja)) {
      falhas += 1;
      continue;
    }
    gerados.push({ ...pendentes[i], linkAfiliado: url });
  }

  return {
    produtos: [...prontos, ...gerados].sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),
    falhas,
    nativos: prontos.length,
  };
}

async function obterLojaDb(loja) {
  const { data, error } = await supabase
    .from("economize_lojas")
    .select("id,nome,slug,ativa")
    .eq("slug", loja.dbSlug)
    .eq("ativa", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function publicar(lojaConfig, produtos) {
  const loja = await obterLojaDb(lojaConfig);
  if (!loja) throw new Error(`Loja ativa não encontrada no banco: ${lojaConfig.dbSlug}`);

  const origem = `agente_produtos_awin_${lojaConfig.slug}`;
  const ativos = new Set();
  let criadas = 0;
  let atualizadas = 0;

  for (const produto of produtos) {
    const dedupe = `awin:${lojaConfig.slug}:produto:${produto.id}`;
    ativos.add(dedupe);

    const dados = {
      loja_id: loja.id,
      tipo: "promocao",
      status: "ativo",
      titulo: produto.titulo,
      descricao: produto.descricao || `${produto.percentual}% OFF em produto selecionado na ${lojaConfig.nome}.`,
      codigo: null,
      categoria: produto.categoria,
      regras: "Preço e disponibilidade podem mudar. Confira as condições na loja antes de finalizar a compra.",
      imagem_url: produto.imagem,
      link_destino: produto.link,
      link_afiliado: produto.linkAfiliado,
      desconto_percentual: produto.percentual,
      valor_desconto: produto.economia,
      cashback_percentual: null,
      pedido_minimo: null,
      preco_original: produto.precoOriginal,
      preco_oferta: produto.precoOferta,
      data_inicio: null,
      validade: produto.validade,
      destaque: false,
      selos: ["Oferta via Awin", `${produto.percentual}% OFF`],
      origem,
      origem_url: produto.link,
      dedupe_key: dedupe,
      dados_brutos: {
        fonte: produto.fonte,
        advertiser_id: Number(lojaConfig.advertiserId),
        publisher_id: Number(PUBLISHER_ID),
        product_id: produto.id,
        marca: produto.marca,
        percentual: produto.percentual,
        tracking_validado: true,
      },
      coletado_em: agora(),
      verificado_em: agora(),
      updated_at: agora(),
    };

    const { data: existente, error: erroBusca } = await supabase
      .from("economize_ofertas")
      .select("id")
      .eq("dedupe_key", dedupe)
      .maybeSingle();

    if (erroBusca) throw erroBusca;

    if (existente) {
      const { error } = await supabase.from("economize_ofertas").update(dados).eq("id", existente.id);
      if (error) throw error;
      atualizadas += 1;
    } else {
      const { error } = await supabase.from("economize_ofertas").insert(dados);
      if (error) throw error;
      criadas += 1;
    }
  }

  const { data: existentes, error: erroExistentes } = await supabase
    .from("economize_ofertas")
    .select("id,dedupe_key")
    .eq("loja_id", loja.id)
    .eq("origem", origem)
    .eq("status", "ativo");

  if (erroExistentes) throw erroExistentes;

  const expirar = (existentes || [])
    .filter((item) => !ativos.has(texto(item.dedupe_key)))
    .map((item) => item.id);

  if (expirar.length) {
    const momento = agora();
    const { error } = await supabase
      .from("economize_ofertas")
      .update({ status: "expirado", validade: momento, verificado_em: momento, updated_at: momento })
      .in("id", expirar);
    if (error) throw error;
  }

  return { criadas, atualizadas, expiradas: expirar.length };
}

async function main() {
  salvarStatus({
    executando: true,
    sucesso: null,
    inicio: agora(),
    modo: CONFIRMAR ? "publicacao" : "preview",
    fonte: "awin_legacy_product_feed",
  });

  const listaFeeds = await buscarListaFeeds();
  console.log(`Lista AWIN carregada: ${listaFeeds.length} feeds acessíveis.`);

  const resumo = [];

  for (const loja of lojas) {
    const item = {
      slug: loja.slug,
      nome: loja.nome,
      advertiser_id: loja.advertiserId,
      feed_disponivel: false,
      feeds_encontrados: 0,
      feeds_lidos: 0,
      total_feed: 0,
      elegiveis: 0,
      selecionados: 0,
      links_afiliados_ok: 0,
      links_afiliados_nativos: 0,
      links_afiliados_falha: 0,
      criadas: 0,
      atualizadas: 0,
      expiradas: 0,
      erro: null,
    };

    try {
      console.log(`\n=== AWIN LEGACY PRODUTOS: ${loja.nome} ===`);
      const feeds = feedsDaLoja(listaFeeds, loja);
      item.feeds_encontrados = feeds.length;

      const feed = await lerFeedLegacy(loja, feeds);
      item.feed_disponivel = feed.disponivel;
      item.feeds_lidos = feed.feedsLidos;
      item.total_feed = feed.total;
      item.elegiveis = feed.elegiveis;
      item.selecionados = feed.selecionados.length;

      if (!feed.disponivel) {
        item.erro = feed.motivo;
        resumo.push(item);
        continue;
      }

      console.log(
        `Feeds=${feed.feedsLidos}/${feeds.length} | produtos=${feed.total} | elegíveis=${feed.elegiveis} | top=${feed.selecionados.length}`
      );

      const links = await gerarLinksAfiliados(loja, feed.selecionados);
      item.links_afiliados_ok = links.produtos.length;
      item.links_afiliados_nativos = links.nativos;
      item.links_afiliados_falha = links.falhas;

      if (CONFIRMAR && links.produtos.length) {
        const pub = await publicar(loja, links.produtos);
        item.criadas = pub.criadas;
        item.atualizadas = pub.atualizadas;
        item.expiradas = pub.expiradas;
      }

      console.log(
        `Afiliados OK=${item.links_afiliados_ok} | nativos_feed=${item.links_afiliados_nativos} | falhas=${item.links_afiliados_falha}`
      );
    } catch (erro) {
      item.erro = erro instanceof Error ? erro.message : String(erro);
      console.error(`ERRO ${loja.slug}: ${item.erro}`);
    }

    resumo.push(item);
  }

  const resultado = {
    sucesso: resumo.some((item) => item.feed_disponivel),
    modo: CONFIRMAR ? "publicacao" : "preview",
    fonte: "awin_legacy_product_feed",
    publisher_id: PUBLISHER_ID,
    datafeed_key_configurada: true,
    feeds_acessiveis_total: listaFeeds.length,
    desconto_minimo: DESCONTO_MINIMO,
    limite_por_loja: LIMITE_POR_LOJA,
    lojas: resumo,
    executado_em: agora(),
  };

  fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(resultado, null, 2), "utf8");
  salvarStatus({ executando: false, ...resultado, fim: agora() });
  console.log("\n=== VARREDURA AWIN LEGACY CONCLUÍDA ===");
  console.log(JSON.stringify(resultado));

  if (!resultado.sucesso) process.exitCode = 2;
}

main().catch((erro) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  salvarStatus({ executando: false, sucesso: false, erro: mensagem, fim: agora() });
  console.error("ERRO FATAL AWIN LEGACY:", mensagem);
  process.exitCode = 1;
});
