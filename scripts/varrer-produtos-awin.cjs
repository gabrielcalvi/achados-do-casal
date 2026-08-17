const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const lojasConfig = require("./awin-lojas.config.cjs");

const CONFIRMAR = process.argv.includes("CONFIRMAR");
const PUBLISHER_ID = String(process.env.AWIN_PUBLISHER_ID || "2922231").trim();
const AWIN_API_TOKEN = String(process.env.AWIN_API_TOKEN || "").trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const LIMITE_POR_LOJA = Math.max(1, Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15)));
const DESCONTO_MINIMO = Math.max(1, Math.min(90, Number(process.env.AWIN_PRODUTOS_DESCONTO_MINIMO || 10)));
const STATUS_FILE = "/vercel/tmp/awin-produtos-status.json";
const RESULT_FILE = "/vercel/tmp/awin-produtos-resultado.json";

if (!AWIN_API_TOKEN) throw new Error("AWIN_API_TOKEN ausente.");
if (!supabaseUrl || !serviceKey) throw new Error("Credenciais Supabase ausentes.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const lojas = lojasConfig.filter(
  (loja) => !loja.monitorOnly && ["cea", "renner", "calvin-klein", "stanley", "casas-bahia"].includes(loja.slug)
);

function agora() {
  return new Date().toISOString();
}

function salvarStatus(dados) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ atualizadoEm: agora(), ...dados }, null, 2));
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function encontrarCampo(obj, chave, profundidade = 0) {
  if (!obj || typeof obj !== "object" || profundidade > 4) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, chave)) return obj[chave];

  for (const valor of Object.values(obj)) {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      const achado = encontrarCampo(valor, chave, profundidade + 1);
      if (achado !== undefined) return achado;
    }
  }

  return undefined;
}

function parsePreco(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return { valor, moeda: "BRL" };
  }

  const s = texto(valor).replace(/\s+/g, " ");
  const moeda = (s.match(/\b([A-Z]{3})\b/i)?.[1] || "BRL").toUpperCase();
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

function urlValida(valor, dominio) {
  try {
    const url = new URL(texto(valor));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const esperado = dominio.toLowerCase().replace(/^www\./, "");
    if (!host.replace(/^www\./, "").endsWith(esperado)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function vendaAtiva(valor) {
  const periodo = texto(valor);
  if (!periodo || !periodo.includes("/")) return true;

  const [inicio, fim] = periodo.split("/");
  const agoraMs = Date.now();
  const inicioMs = Date.parse(inicio);
  const fimMs = Date.parse(fim);

  if (Number.isFinite(inicioMs) && inicioMs > agoraMs) return false;
  if (Number.isFinite(fimMs) && fimMs <= agoraMs) return false;
  return true;
}

function normalizarProduto(linha, loja) {
  if (!linha || linha.error) return null;

  const id = texto(encontrarCampo(linha, "id"));
  const titulo = texto(encontrarCampo(linha, "title"));
  const descricao = texto(encontrarCampo(linha, "description"));
  const link = urlValida(encontrarCampo(linha, "link"), loja.dominio);
  const imagem = texto(encontrarCampo(linha, "image_link"));
  const disponibilidade = texto(encontrarCampo(linha, "availability")).toLowerCase();
  const expiracao = texto(encontrarCampo(linha, "expiration_date"));
  const preco = parsePreco(encontrarCampo(linha, "price"));
  const precoOferta = parsePreco(encontrarCampo(linha, "sale_price"));
  const periodoOferta = encontrarCampo(linha, "sale_price_effective_date");
  const categoria = texto(
    encontrarCampo(linha, "product_type") || encontrarCampo(linha, "google_product_category")
  );
  const marca = texto(encontrarCampo(linha, "brand"));

  if (!id || !titulo || !link || !imagem || !preco || !precoOferta) return null;
  if (disponibilidade && disponibilidade !== "in_stock") return null;
  if (preco.moeda !== "BRL" || precoOferta.moeda !== "BRL") return null;
  if (precoOferta.valor >= preco.valor) return null;
  if (!vendaAtiva(periodoOferta)) return null;

  if (expiracao) {
    const expiraMs = Date.parse(expiracao);
    if (Number.isFinite(expiraMs) && expiraMs <= Date.now()) return null;
  }

  const economia = preco.valor - precoOferta.valor;
  const percentual = Math.round((economia / preco.valor) * 1000) / 10;
  if (percentual < DESCONTO_MINIMO) return null;

  return {
    id,
    titulo,
    descricao,
    link,
    imagem,
    categoria: categoria || null,
    marca: marca || null,
    precoOriginal: preco.valor,
    precoOferta: precoOferta.valor,
    economia,
    percentual,
    validade: expiracao || null,
    bruto: linha,
  };
}

function chaveSimilar(produto) {
  return `${produto.marca || ""}|${produto.titulo}`
    .toLowerCase()
    .replace(/\b(tam|tamanho|size|cor|color)\b[^|,;]*/g, "")
    .replace(/[^a-z0-9áàâãéêíóôõúç]+/gi, " ")
    .trim()
    .slice(0, 140);
}

function inserirTop(lista, produto) {
  const chave = chaveSimilar(produto);
  const existente = lista.findIndex((item) => chaveSimilar(item) === chave);

  if (existente >= 0) {
    const atual = lista[existente];
    if (
      produto.percentual > atual.percentual ||
      (produto.percentual === atual.percentual && produto.economia > atual.economia)
    ) {
      lista[existente] = produto;
    }
  } else {
    lista.push(produto);
  }

  lista.sort((a, b) =>
    b.percentual - a.percentual || b.economia - a.economia || a.precoOferta - b.precoOferta
  );

  if (lista.length > LIMITE_POR_LOJA * 4) lista.length = LIMITE_POR_LOJA * 4;
}

async function lerFeed(loja) {
  const endpoint = `https://api.awin.com/publishers/${encodeURIComponent(PUBLISHER_ID)}/awinfeeds/download/${encodeURIComponent(loja.advertiserId)}-retail-pt_BR.jsonl`;
  const resposta = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${AWIN_API_TOKEN}`,
      Accept: "application/jsonlines, application/x-ndjson, application/json, text/plain",
    },
    signal: AbortSignal.timeout(180000),
  });

  if (resposta.status === 404) {
    return { disponivel: false, motivo: "feed_enhanced_pt_BR_nao_encontrado", total: 0, elegiveis: 0, selecionados: [] };
  }

  if (!resposta.ok || !resposta.body) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Feed ${loja.slug} HTTP ${resposta.status}: ${corpo.slice(0, 240)}`);
  }

  let total = 0;
  let elegiveis = 0;
  let ultimoObjeto = null;
  let buffer = "";
  const decoder = new TextDecoder();
  const top = [];

  async function processarLinha(original) {
    const linha = original.trim();
    if (!linha) return;

    let json;
    try {
      json = JSON.parse(linha);
    } catch {
      return;
    }

    ultimoObjeto = json;
    if (json && json.error) return;

    total += 1;
    const produto = normalizarProduto(json, loja);
    if (!produto) return;

    elegiveis += 1;
    inserirTop(top, produto);
  }

  for await (const chunk of resposta.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let quebra;
    while ((quebra = buffer.indexOf("\n")) >= 0) {
      const linha = buffer.slice(0, quebra);
      buffer = buffer.slice(quebra + 1);
      await processarLinha(linha);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) await processarLinha(buffer);

  if (ultimoObjeto && ultimoObjeto.error) {
    throw new Error(`Feed ${loja.slug} terminou com erro ${ultimoObjeto.error}: ${texto(ultimoObjeto.message)}`);
  }

  return {
    disponivel: true,
    total,
    elegiveis,
    selecionados: top.slice(0, LIMITE_POR_LOJA),
  };
}

async function gerarLinksAfiliados(loja, produtos) {
  if (!produtos.length) return { produtos: [], falhas: 0 };

  const endpoint = `https://api.awin.com/publishers/${encodeURIComponent(PUBLISHER_ID)}/linkbuilder/generate-batch?accessToken=${encodeURIComponent(AWIN_API_TOKEN)}`;
  const resposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AWIN_API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      requests: produtos.map((produto) => ({
        advertiserId: Number(loja.advertiserId),
        destinationUrl: produto.link,
        parameters: { campaign: "achados-economize-produtos" },
      })),
    }),
    signal: AbortSignal.timeout(60000),
  });

  const textoResposta = await resposta.text();
  let json;
  try {
    json = JSON.parse(textoResposta);
  } catch {
    throw new Error(`Link Builder ${loja.slug} respondeu JSON invalido: ${textoResposta.slice(0, 200)}`);
  }

  if (!resposta.ok) {
    throw new Error(`Link Builder ${loja.slug} HTTP ${resposta.status}: ${textoResposta.slice(0, 300)}`);
  }

  const responses = Array.isArray(json.responses) ? json.responses : [];
  let falhas = 0;
  const comLinks = [];

  for (let i = 0; i < produtos.length; i += 1) {
    const item = responses[i];
    const url = texto(item?.body?.url || item?.body?.trackingUrl || item?.url);

    if (Number(item?.status || 0) !== 200 || !url) {
      falhas += 1;
      continue;
    }

    const trackingValido =
      url.includes(`awinmid=${loja.advertiserId}`) &&
      url.includes(`awinaffid=${PUBLISHER_ID}`);

    if (!trackingValido) {
      falhas += 1;
      continue;
    }

    comLinks.push({ ...produtos[i], linkAfiliado: url });
  }

  return { produtos: comLinks, falhas };
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
      descricao:
        produto.descricao ||
        `${produto.percentual}% OFF em produto selecionado na ${lojaConfig.nome}.`,
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
        fonte: "awin_enhanced_product_feed",
        advertiser_id: Number(lojaConfig.advertiserId),
        publisher_id: Number(PUBLISHER_ID),
        product_id: produto.id,
        marca: produto.marca,
        percentual: produto.percentual,
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
    const { error } = await supabase
      .from("economize_ofertas")
      .update({ status: "expirado", validade: agora(), verificado_em: agora(), updated_at: agora() })
      .in("id", expirar);
    if (error) throw error;
  }

  return { criadas, atualizadas, expiradas: expirar.length };
}

async function main() {
  salvarStatus({ executando: true, sucesso: null, inicio: agora(), modo: CONFIRMAR ? "publicacao" : "preview" });

  const resumo = [];

  for (const loja of lojas) {
    const item = {
      slug: loja.slug,
      nome: loja.nome,
      advertiser_id: loja.advertiserId,
      feed_disponivel: false,
      total_feed: 0,
      elegiveis: 0,
      selecionados: 0,
      links_afiliados_ok: 0,
      links_afiliados_falha: 0,
      criadas: 0,
      atualizadas: 0,
      expiradas: 0,
      erro: null,
    };

    try {
      console.log(`\n=== AWIN PRODUTOS: ${loja.nome} ===`);
      const feed = await lerFeed(loja);
      item.feed_disponivel = feed.disponivel;
      item.total_feed = feed.total;
      item.elegiveis = feed.elegiveis;
      item.selecionados = feed.selecionados.length;

      if (!feed.disponivel) {
        item.erro = feed.motivo;
        console.log(`Feed enhanced pt_BR indisponível para ${loja.nome}.`);
        resumo.push(item);
        continue;
      }

      console.log(`Produtos lidos=${feed.total} | elegíveis=${feed.elegiveis} | top=${feed.selecionados.length}`);

      const links = await gerarLinksAfiliados(loja, feed.selecionados);
      item.links_afiliados_ok = links.produtos.length;
      item.links_afiliados_falha = links.falhas;

      if (CONFIRMAR && links.produtos.length) {
        const pub = await publicar(loja, links.produtos);
        item.criadas = pub.criadas;
        item.atualizadas = pub.atualizadas;
        item.expiradas = pub.expiradas;
      }

      console.log(`Afiliados OK=${item.links_afiliados_ok} | falhas=${item.links_afiliados_falha}`);
    } catch (erro) {
      item.erro = erro instanceof Error ? erro.message : String(erro);
      console.error(`ERRO ${loja.slug}: ${item.erro}`);
    }

    resumo.push(item);
  }

  const resultado = {
    sucesso: resumo.some((item) => item.feed_disponivel),
    modo: CONFIRMAR ? "publicacao" : "preview",
    publisher_id: PUBLISHER_ID,
    desconto_minimo: DESCONTO_MINIMO,
    limite_por_loja: LIMITE_POR_LOJA,
    lojas: resumo,
    executado_em: agora(),
  };

  fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(resultado, null, 2));
  salvarStatus({ executando: false, ...resultado, fim: agora() });
  console.log("\n=== VARREDURA AWIN PRODUTOS CONCLUÍDA ===");
  console.log(JSON.stringify(resultado));

  if (!resultado.sucesso) process.exitCode = 2;
}

main().catch((erro) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  salvarStatus({ executando: false, sucesso: false, erro: mensagem, fim: agora() });
  console.error("ERRO FATAL AWIN PRODUTOS:", mensagem);
  process.exitCode = 1;
});
