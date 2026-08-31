const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const origem = process.env.AWIN_NIKE_BASE_SCRIPT
  ? path.resolve(process.env.AWIN_NIKE_BASE_SCRIPT)
  : path.join(__dirname, "varrer-produtos-awin-legacy.cjs");
const temporario = path.join(__dirname, ".varrer-produtos-awin-nike-seguro-temp.cjs");
const observacaoHoras = Math.max(
  6,
  Math.min(168, Number(process.env.NIKE_AWIN_OBSERVACAO_HORAS || 24))
);

if (!fs.existsSync(origem)) {
  throw new Error(`Coletor Legacy nao encontrado: ${origem}`);
}

let codigo = fs.readFileSync(origem, "utf8");

const filtroLojas = `["cea", "renner", "calvin-klein", "stanley", "casas-bahia"].includes(loja.slug)`;
const filtroNike = `["nike"].includes(loja.slug)`;

if (!codigo.includes(filtroLojas)) {
  throw new Error("Nao foi possivel isolar a Nike no coletor Legacy.");
}

codigo = codigo.replace(filtroLojas, filtroNike);

const filtroMembership = `return !status || status.includes("joined") || status.includes("aprov");`;
const filtroMembershipNike = `return !status || status.includes("joined") || status.includes("aprov") || status.includes("active") || status.includes("ativo");`;

if (!codigo.includes(filtroMembership)) {
  throw new Error("Nao foi possivel ajustar o status de parceria da Nike.");
}

codigo = codigo.replace(filtroMembership, filtroMembershipNike);

codigo = codigo
  .replace(
    `const STATUS_FILE = "/vercel/tmp/awin-produtos-status.json";`,
    `const STATUS_FILE = "/vercel/tmp/awin-nike-produtos-status.json";`
  )
  .replace(
    `const RESULT_FILE = "/vercel/tmp/awin-produtos-resultado.json";`,
    `const RESULT_FILE = "/vercel/tmp/awin-nike-produtos-resultado.json";`
  );

const marcadorNormalizador = `function normalizarProdutoLegacy(row, loja) {`;
const helperRisco = `function possuiSinalRiscoNike(row) {
  const conteudo = [
    campo(row, ["product_name", "name", "title"]),
    campo(row, ["description", "product_short_description"]),
    campo(row, ["merchant_product_category_path", "merchant_category", "category_name"]),
    campo(row, ["product_type", "merchant_product_second_category"]),
    campo(row, ["promotional_text", "promotion", "offer_text"]),
    campo(row, ["merchant_deep_link", "merchant_link", "product_url"]),
  ]
    .map((valor) => texto(valor))
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();

  return /(lancamento|pre[- ]?venda|preorder|pre order|coming soon|early access|acesso antecipado|snkrs|countdown|contagem regressiva|disponivel em breve|em breve|launch date|launch calendar)/i.test(conteudo);
}

${marcadorNormalizador}`;

if (!codigo.includes(marcadorNormalizador)) {
  throw new Error("Nao foi possivel inserir o filtro de risco da Nike.");
}

codigo = codigo.replace(marcadorNormalizador, helperRisco);

const marcadorMarca = `  const marca = texto(campo(row, ["brand_name", "brand"]));`;
const marcaComProtecao = `${marcadorMarca}

  if (loja.slug === "nike" && possuiSinalRiscoNike(row)) return null;`;

if (!codigo.includes(marcadorMarca)) {
  throw new Error("Nao foi possivel ativar o bloqueio de lancamentos Nike.");
}

codigo = codigo.replace(marcadorMarca, marcaComProtecao);

// O batch Link Builder esta respondendo 400 para a Nike mesmo com parceria e feed ativos.
// Gera o deep link pelo tracking direto AWIN, usando advertiser, publisher e destino.
const marcadorLinks = `async function gerarLinksAfiliados(loja, produtos) {`;
const helperLinksNike = `function linkAfiliadoNikeDireto(loja, destino) {
  const params = new URLSearchParams({
    awinmid: String(loja.advertiserId),
    awinaffid: PUBLISHER_ID,
    campaign: "achados-economize-produtos",
    ued: destino,
    platform: "pl",
  });
  return \`https://www.awin1.com/cread.php?\${params.toString()}\`;
}

async function gerarLinksAfiliados(loja, produtos) {
  if (loja.slug === "nike") {
    const prontosNike = produtos.map((produto) => ({
      ...produto,
      linkAfiliado: linkAfiliadoNikeDireto(loja, produto.link),
    }));
    return {
      produtos: prontosNike.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),
      falhas: 0,
      nativos: prontosNike.length,
    };
  }`;

if (!codigo.includes(marcadorLinks)) {
  throw new Error("Nao foi possivel ativar tracking direto da Nike.");
}
codigo = codigo.replace(marcadorLinks, helperLinksNike);

const marcadorPublicar = `async function publicar(lojaConfig, produtos) {`;
const publicarNikeSeguro = `async function publicarNikeSeguro(lojaConfig, produtos) {
  const loja = await obterLojaDb(lojaConfig);
  if (!loja) throw new Error(\`Loja ativa nao encontrada no banco: \${lojaConfig.dbSlug}\`);

  const origem = \`agente_produtos_awin_\${lojaConfig.slug}\`;
  const presentes = new Set();
  let criadas = 0;
  let atualizadas = 0;
  let ativadas = 0;
  let pendentes = 0;

  for (const produto of produtos) {
    const dedupe = \`awin:\${lojaConfig.slug}:produto:\${produto.id}\`;
    presentes.add(dedupe);

    const { data: existente, error: erroBusca } = await supabase
      .from("economize_ofertas")
      .select("id,status,coletado_em,dados_brutos")
      .eq("dedupe_key", dedupe)
      .maybeSingle();

    if (erroBusca) throw erroBusca;

    const momento = agora();
    const primeiraObservacao =
      texto(existente?.dados_brutos?.nike_primeira_observacao) ||
      texto(existente?.coletado_em) ||
      momento;

    const primeiraMs = Date.parse(primeiraObservacao);
    const idadeHoras = Number.isFinite(primeiraMs)
      ? Math.max(0, (Date.now() - primeiraMs) / 3600000)
      : 0;

    const jaAtivo = existente?.status === "ativo";
    const liberado = jaAtivo || idadeHoras >= ${observacaoHoras};
    const status = liberado ? "ativo" : "pendente";

    if (status === "ativo" && !jaAtivo) ativadas += 1;
    if (status === "pendente") pendentes += 1;

    const dados = {
      loja_id: loja.id,
      tipo: "promocao",
      status,
      titulo: produto.titulo,
      descricao: produto.descricao || \`\${produto.percentual}% OFF em produto selecionado na \${lojaConfig.nome}.\`,
      codigo: null,
      categoria: produto.categoria,
      regras: "Produto validado pelo feed oficial AWIN. Preco e disponibilidade podem mudar. Confira as condicoes na loja antes de finalizar a compra.",
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
      selos: ["Oferta via Awin", "Nike Seguro", \`\${produto.percentual}% OFF\`],
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
        nike_modo_seguro: true,
        nike_primeira_observacao: primeiraObservacao,
        nike_observacao_horas: Math.round(idadeHoras * 10) / 10,
        nike_observacao_minima_horas: ${observacaoHoras},
        nike_bloqueio_sinais_lancamento: true,
        nike_liberado_automaticamente: liberado,
      },
      coletado_em: texto(existente?.coletado_em) || momento,
      verificado_em: momento,
      updated_at: momento,
    };

    if (existente) {
      const { error } = await supabase
        .from("economize_ofertas")
        .update(dados)
        .eq("id", existente.id);
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
    .select("id,dedupe_key,status")
    .eq("loja_id", loja.id)
    .eq("origem", origem)
    .in("status", ["ativo", "pendente"]);

  if (erroExistentes) throw erroExistentes;

  const expirar = (existentes || [])
    .filter((item) => !presentes.has(texto(item.dedupe_key)))
    .map((item) => item.id);

  if (expirar.length) {
    const momento = agora();
    const { error } = await supabase
      .from("economize_ofertas")
      .update({
        status: "expirado",
        validade: momento,
        verificado_em: momento,
        updated_at: momento,
      })
      .in("id", expirar);
    if (error) throw error;
  }

  console.log(
    \`[NIKE SEGURO] criadas=\${criadas} atualizadas=\${atualizadas} pendentes=\${pendentes} ativadas=\${ativadas} expiradas=\${expirar.length}\`
  );

  return { criadas, atualizadas, expiradas: expirar.length };
}

${marcadorPublicar}
  if (lojaConfig.slug === "nike") {
    return publicarNikeSeguro(lojaConfig, produtos);
  }`;

if (!codigo.includes(marcadorPublicar)) {
  throw new Error("Nao foi possivel ativar a quarentena de produtos Nike.");
}

codigo = codigo.replace(marcadorPublicar, publicarNikeSeguro);

fs.writeFileSync(temporario, codigo, "utf8");

try {
  const resultado = spawnSync(process.execPath, [temporario, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AWIN_PRODUTOS_LIMITE_POR_LOJA:
        process.env.NIKE_AWIN_LIMITE_PRODUTOS ||
        process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA ||
        "16",
      AWIN_PRODUTOS_DESCONTO_MINIMO:
        process.env.NIKE_AWIN_DESCONTO_MINIMO ||
        process.env.AWIN_PRODUTOS_DESCONTO_MINIMO ||
        "10",
    },
    stdio: "inherit",
  });

  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  try {
    fs.unlinkSync(temporario);
  } catch {}
}
