const fs = require("fs");
const path = require("path");

function carregarEnv() {
  const arquivo = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(arquivo)) {
    throw new Error(".env.local nao encontrado.");
  }

  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const texto = linha.trim();

    if (!texto || texto.startsWith("#")) continue;

    const pos = texto.indexOf("=");
    if (pos < 1) continue;

    const chave = texto.slice(0, pos).trim();
    let valor = texto.slice(pos + 1).trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

carregarEnv();

const { createClient } = require("@supabase/supabase-js");

const CONFIRMAR =
  process.argv.includes("CONFIRMAR");

const ADVERTISER_ID = "17648";
const PUBLISHER_ID =
  process.env.AWIN_PUBLISHER_ID || "2922231";

const ORIGEM = "agente_cupons_awin_cea";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Credenciais Supabase nao encontradas.");
}

const supabase = createClient(
  supabaseUrl,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function limpar(valor) {
  return String(valor ?? "").trim();
}

function carregarColeta() {
  const arquivo = path.join(
    process.cwd(),
    "tmp",
    "cupons-cea-awin.json"
  );

  if (!fs.existsSync(arquivo)) {
    throw new Error(
      "tmp/cupons-cea-awin.json nao encontrado."
    );
  }

  const json = JSON.parse(
    fs.readFileSync(arquivo, "utf8")
  );

  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json.cupons)) {
    return json.cupons;
  }

  if (Array.isArray(json.itens)) {
    return json.itens;
  }

  return [];
}

function validarCupom(cupom) {
  if (String(cupom.advertiserId) !== ADVERTISER_ID) {
    throw new Error("Advertiser C&A invalido.");
  }

  if (!cupom.promotionId) {
    throw new Error("promotionId ausente.");
  }

  if (!limpar(cupom.codigo)) {
    throw new Error("Codigo ausente.");
  }

  if (cupom.tipoDesconto !== "percentual") {
    throw new Error(
      "Tipo de desconto inesperado para o voucher atual."
    );
  }

  if (Number(cupom.valorDesconto) !== 8) {
    throw new Error(
      `Desconto esperado no site = 8%. Recebido: ${cupom.valorDesconto}`
    );
  }

  const tracking = limpar(cupom.linkAfiliado);

  if (
    !tracking.includes(`awinmid=${ADVERTISER_ID}`) ||
    !tracking.includes(`awinaffid=${PUBLISHER_ID}`)
  ) {
    throw new Error(
      "Tracking Awin nao contem advertiser/publisher esperados."
    );
  }

  const validade = Date.parse(cupom.validade || "");

  if (
    Number.isFinite(validade) &&
    validade <= Date.now()
  ) {
    throw new Error("Voucher expirado.");
  }
}

async function obterLoja() {
  const { data, error } = await supabase
    .from("economize_lojas")
    .select("id,nome,slug,dominio,logo_url,ativa")
    .eq("slug", "cea")
    .eq("ativa", true)
    .single();

  if (error || !data) {
    throw new Error(
      "Loja C&A ativa nao encontrada."
    );
  }

  return data;
}

function montarDados(cupom, loja) {
  const agora = new Date().toISOString();

  const codigo =
    limpar(cupom.codigo).toUpperCase();

  const promotionId =
    String(cupom.promotionId);

  const titulo =
    "8% OFF na C&A | 10% OFF no app";

  const descricao =
    "Use o cupom AFILIADOS10 para obter 8% OFF no site da C&A ou 10% OFF no app, em Apparel, beleza, óculos e relógios, em compras a partir de R$ 199.";

  const regras =
    "8% OFF no site e 10% OFF no app em Apparel, beleza, óculos e relógios, em compras a partir de R$ 199. Cupom oficial disponibilizado pela C&A via Awin. Confira as condições antes de finalizar a compra.";

  const dedupeCupom =
    `awin:cea:voucher:${promotionId}`;

  const dedupeOferta =
    `awin:cea:voucher:${promotionId}:landing`;

  const dadosBrutos = {
    fonte: "awin",
    advertiser_id: Number(ADVERTISER_ID),
    publisher_id: Number(PUBLISHER_ID),
    promotion_id: cupom.promotionId,
    codigo,
    beneficio_site_percentual: 8,
    beneficio_app_percentual: 10,
    pedido_minimo: 199,
    categorias:
      "Apparel, beleza, óculos e relógios",
    awin: cupom,
  };

  const oferta = {
    loja_id: loja.id,
    tipo: "cupom",
    status: "ativo",
    titulo,
    descricao,
    codigo,
    categoria:
      "Moda, beleza, óculos e relógios",
    regras,
    imagem_url: loja.logo_url || null,
    link_destino: cupom.linkDestino,
    link_afiliado: cupom.linkAfiliado,
    desconto_percentual: 8,
    valor_desconto: null,
    cashback_percentual: null,
    pedido_minimo: 199,
    preco_original: null,
    preco_oferta: null,
    data_inicio: cupom.inicio || null,
    validade: cupom.validade || null,
    destaque: false,
    selos: ["Cupom oficial Awin"],
    origem: ORIGEM,
    origem_url: cupom.linkDestino,
    dedupe_key: dedupeOferta,
    dados_brutos: dadosBrutos,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  const cupomDb = {
    loja_id: loja.id,
    status: "ativo",
    codigo,
    titulo,
    descricao,
    regras,
    tipo_desconto: "percentual",
    desconto_percentual: 8,
    valor_desconto: null,
    pedido_minimo: 199,
    limite_desconto: null,
    publico_alvo:
      "Apparel, beleza, óculos e relógios",
    elegibilidade:
      "8% no site; 10% no app; compras a partir de R$ 199",
    limite_por_usuario: null,
    somente_app: false,
    exige_mercado_pago: false,
    data_inicio: cupom.inicio || null,
    validade: cupom.validade || null,
    link_destino: cupom.linkDestino,
    link_afiliado: cupom.linkAfiliado,
    origem: ORIGEM,
    origem_url: cupom.linkDestino,
    dedupe_key: dedupeCupom,
    dados_brutos: dadosBrutos,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  return {
    codigo,
    oferta,
    cupomDb,
    dedupeOferta,
    dedupeCupom,
  };
}

async function salvarOferta(dados) {
  const { data: existente, error: erroBusca } =
    await supabase
      .from("economize_ofertas")
      .select("id")
      .eq("dedupe_key", dados.dedupeOferta)
      .maybeSingle();

  if (erroBusca) throw erroBusca;

  if (existente) {
    const { data, error } = await supabase
      .from("economize_ofertas")
      .update(dados.oferta)
      .eq("id", existente.id)
      .select("id")
      .single();

    if (error) throw error;

    return {
      id: data.id,
      acao: "atualizada",
    };
  }

  const { data, error } = await supabase
    .from("economize_ofertas")
    .insert(dados.oferta)
    .select("id")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    acao: "criada",
  };
}

async function salvarCupom(dados) {
  const { data: existenteCodigo, error: erroCodigo } =
    await supabase
      .from("economize_cupons")
      .select("id,origem,dedupe_key")
      .eq("loja_id", dados.cupomDb.loja_id)
      .eq("codigo", dados.codigo)
      .maybeSingle();

  if (erroCodigo) throw erroCodigo;

  if (existenteCodigo) {
    if (
      existenteCodigo.origem &&
      existenteCodigo.origem !== ORIGEM
    ) {
      throw new Error(
        `Cupom ${dados.codigo} ja existe com origem diferente: ${existenteCodigo.origem}`
      );
    }

    const { data, error } = await supabase
      .from("economize_cupons")
      .update(dados.cupomDb)
      .eq("id", existenteCodigo.id)
      .select("id")
      .single();

    if (error) throw error;

    return {
      id: data.id,
      acao: "atualizado",
    };
  }

  const { data, error } = await supabase
    .from("economize_cupons")
    .insert(dados.cupomDb)
    .select("id")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    acao: "criado",
  };
}

async function vincular(cupomId, ofertaId) {
  const { data: existente, error: erroBusca } =
    await supabase
      .from("economize_cupons_ofertas")
      .select("cupom_id,oferta_id")
      .eq("cupom_id", cupomId)
      .eq("oferta_id", ofertaId)
      .maybeSingle();

  if (erroBusca) throw erroBusca;

  if (existente) {
    return "ja_existia";
  }

  const { error } = await supabase
    .from("economize_cupons_ofertas")
    .insert({
      cupom_id: cupomId,
      oferta_id: ofertaId,
    });

  if (error) throw error;

  return "criado";
}

async function main() {
  const coleta = carregarColeta();

  const cupom =
    coleta.find(
      (item) =>
        limpar(item.codigo).toUpperCase() ===
        "AFILIADOS10"
    );

  if (!cupom) {
    throw new Error(
      "AFILIADOS10 nao encontrado na coleta atual."
    );
  }

  validarCupom(cupom);

  const loja = await obterLoja();
  const dados = montarDados(cupom, loja);

  console.log("\n=== PREVIA PUBLICACAO C&A ===");
  console.log(`Loja: ${loja.nome}`);
  console.log(`Slug: ${loja.slug}`);
  console.log(`Advertiser: ${ADVERTISER_ID}`);
  console.log(`Publisher: ${PUBLISHER_ID}`);
  console.log("");
  console.log(`Codigo: ${dados.codigo}`);
  console.log("Aba publica: CUPONS");
  console.log("Beneficio site: 8% OFF");
  console.log("Beneficio app: 10% OFF");
  console.log("Pedido minimo: R$ 199");
  console.log(
    "Categorias: Apparel, beleza, oculos e relogios"
  );
  console.log(`Validade: ${cupom.validade}`);
  console.log(
    `Tracking Awin: ${
      cupom.linkAfiliado.includes(`awinmid=${ADVERTISER_ID}`) &&
      cupom.linkAfiliado.includes(`awinaffid=${PUBLISHER_ID}`)
        ? "OK"
        : "ERRO"
    }`
  );
  console.log(
    `Imagem: ${loja.logo_url || "sem imagem - usando card generico"}`
  );
  console.log("");
  console.log("Titulo:");
  console.log(dados.cupomDb.titulo);
  console.log("");
  console.log("Regras:");
  console.log(dados.cupomDb.regras);
  console.log("");
  console.log(`Dedupe cupom: ${dados.dedupeCupom}`);
  console.log(`Dedupe oferta: ${dados.dedupeOferta}`);

  if (!CONFIRMAR) {
    console.log("\n=== MODO TESTE ===");
    console.log("Nenhum dado foi alterado.");
    console.log(
      "Execute novamente com CONFIRMAR para publicar."
    );
    return;
  }

  console.log("\n=== PUBLICANDO C&A ===");

  const oferta = await salvarOferta(dados);
  const cupomSalvo = await salvarCupom(dados);

  const vinculo = await vincular(
    cupomSalvo.id,
    oferta.id
  );

  console.log(
    `Oferta: ${oferta.acao} | ${oferta.id}`
  );

  console.log(
    `Cupom: ${cupomSalvo.acao} | ${cupomSalvo.id}`
  );

  console.log(
    `Vinculo: ${vinculo}`
  );

  console.log("\n=== C&A PUBLICADA ===");
  console.log(`Codigo: ${dados.codigo}`);
  console.log("Aba: CUPONS");
}

main().catch((erro) => {
  console.error("\nERRO:", erro.message || erro);
  process.exit(1);
});