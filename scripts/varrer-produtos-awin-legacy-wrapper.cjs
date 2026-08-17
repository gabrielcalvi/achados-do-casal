const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const origem = path.join(__dirname, "varrer-produtos-awin-legacy.cjs");
const temporario = path.join(__dirname, ".varrer-produtos-awin-legacy-normalizado.cjs");

if (!fs.existsSync(origem)) {
  throw new Error(`Coletor Legacy não encontrado: ${origem}`);
}

let codigo = fs.readFileSync(origem, "utf8");
const trecho = `.replace(/^\\uFEFF/, "")\n    .normalize("NFD")`;
const substituto = `.replace(/^\\uFEFF/, "")\n    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")\n    .normalize("NFD")`;

if (!codigo.includes(trecho)) {
  throw new Error("Não foi possível aplicar normalização CamelCase/PascalCase no coletor Legacy.");
}

codigo = codigo.replace(trecho, substituto);

const filtroMembership = `return !status || status.includes("joined") || status.includes("aprov");`;
const filtroMembershipAtivo = `return !status || status === "active" || status.includes("joined") || status.includes("aprov");`;

if (!codigo.includes(filtroMembership)) {
  throw new Error("Não foi possível localizar o filtro de membership do coletor Legacy.");
}

codigo = codigo.replace(filtroMembership, filtroMembershipAtivo);

const colunasDiretoAntigas = `["merchant_deep_link", "merchant_link", "product_url"]`;
const colunasDiretoAtuais = `["merchant_deep_link", "merchant_link", "product_url", "deep_link"]`;
const colunasImagemAntigas = `["merchant_image_url", "large_image", "aw_image_url", "merchant_thumb_url"]`;
const colunasImagemAtuais = `["merchant_image_url", "image_url", "image_link", "large_image", "aw_image_url", "merchant_thumb_url", "merchant_thumb"]`;

if (!codigo.includes(colunasDiretoAntigas) || !codigo.includes(colunasImagemAntigas)) {
  throw new Error("Não foi possível localizar as colunas de produto do coletor Legacy.");
}

codigo = codigo
  .replace(colunasDiretoAntigas, colunasDiretoAtuais)
  .replace(colunasImagemAntigas, colunasImagemAtuais);

const marcadorTop = `  const top = [];\n\n  for (const feed of feeds) {`;
const diagnosticoTop = `  const top = [];\n  const diagnostico = {\n    amostras: 0,\n    cabecalhos: [],\n    com_id: 0,\n    com_titulo: 0,\n    com_link_mercante: 0,\n    com_link_qualquer: 0,\n    com_imagem: 0,\n    com_preco_atual: 0,\n    com_preco_original: 0,\n    com_saving: 0,\n    com_percentual: 0,\n  };\n\n  for (const feed of feeds) {`;

if (!codigo.includes(marcadorTop)) {
  throw new Error("Não foi possível inserir diagnóstico agregado no coletor Legacy.");
}

codigo = codigo.replace(marcadorTop, diagnosticoTop);

const marcadorCallback = `    await lerCsvStreaming(stream, delimitador, (row) => {\n      total += 1;\n      const produto = normalizarProdutoLegacy(row, loja);`;
const diagnosticoCallback = `    await lerCsvStreaming(stream, delimitador, (row) => {\n      total += 1;\n      if (diagnostico.amostras < 5000) {\n        diagnostico.amostras += 1;\n        if (!diagnostico.cabecalhos.length) diagnostico.cabecalhos = Object.keys(row).slice(0, 120);\n        if (texto(campo(row, ["aw_product_id", "merchant_product_id", "product_id", "id"]))) diagnostico.com_id += 1;\n        if (texto(campo(row, ["product_name", "name", "title"]))) diagnostico.com_titulo += 1;\n        if (urlValida(campo(row, ["merchant_deep_link", "merchant_link", "product_url"]), loja.dominio)) diagnostico.com_link_mercante += 1;\n        if (texto(campo(row, ["merchant_deep_link", "merchant_link", "product_url", "deep_link", "aw_deep_link", "awin_deep_link"]))) diagnostico.com_link_qualquer += 1;\n        if (imagemValida(campo(row, ["merchant_image_url", "image_url", "image_link", "large_image", "aw_image_url", "merchant_thumb_url", "merchant_thumb"]))) diagnostico.com_imagem += 1;\n        if (parsePreco(campo(row, ["search_price", "store_price", "base_price", "price", "sale_price"]), texto(campo(row, ["currency", "moeda"])) || "BRL")) diagnostico.com_preco_atual += 1;\n        if (parsePreco(campo(row, ["rrp_price", "product_price_old", "old_price", "was_price"]), texto(campo(row, ["currency", "moeda"])) || "BRL")) diagnostico.com_preco_original += 1;\n        if (parsePreco(campo(row, ["saving", "savings"]), texto(campo(row, ["currency", "moeda"])) || "BRL")) diagnostico.com_saving += 1;\n        const pct = numero(campo(row, ["savings_percent", "saving_percent", "discount_percent"]));\n        if (pct !== null && pct > 0) diagnostico.com_percentual += 1;\n      }\n      const produto = normalizarProdutoLegacy(row, loja);`;

if (!codigo.includes(marcadorCallback)) {
  throw new Error("Não foi possível instrumentar callback do feed Legacy.");
}

codigo = codigo.replace(marcadorCallback, diagnosticoCallback);

const marcadorRetorno = `    selecionados: top.slice(0, LIMITE_POR_LOJA),\n    feedsLidos,\n  };`;
const retornoComDiagnostico = `    selecionados: top.slice(0, LIMITE_POR_LOJA),\n    feedsLidos,\n    diagnostico,\n  };`;

if (!codigo.includes(marcadorRetorno)) {
  throw new Error("Não foi possível expor diagnóstico agregado do feed Legacy.");
}

codigo = codigo.replace(marcadorRetorno, retornoComDiagnostico);

const marcadorItem = `      expiradas: 0,\n      erro: null,`;
const itemComDiagnostico = `      expiradas: 0,\n      diagnostico: null,\n      erro: null,`;

if (codigo.includes(marcadorItem)) codigo = codigo.replace(marcadorItem, itemComDiagnostico);

const marcadorFeed = `      item.selecionados = feed.selecionados.length;`;
const feedComDiagnostico = `      item.selecionados = feed.selecionados.length;\n      item.diagnostico = feed.diagnostico || null;\n      if (item.diagnostico) {\n        const d = item.diagnostico;\n        console.log(\`[AWIN diag] loja=\${loja.slug} amostras=\${d.amostras} id=\${d.com_id} titulo=\${d.com_titulo} linkMercante=\${d.com_link_mercante} linkQualquer=\${d.com_link_qualquer} imagem=\${d.com_imagem} precoAtual=\${d.com_preco_atual} precoOriginal=\${d.com_preco_original} saving=\${d.com_saving} percentual=\${d.com_percentual}\`);\n        console.log(\`[AWIN diag headers] loja=\${loja.slug} \${(d.cabecalhos || []).join(',')}\`);\n      }`;

if (codigo.includes(marcadorFeed)) codigo = codigo.replace(marcadorFeed, feedComDiagnostico);

const pontoLista = `const listaFeeds = await buscarListaFeeds();\n  console.log(`;
const listaComDiagnostico = `const listaFeeds = await buscarListaFeeds();\n  const feedListHeaders = Object.keys(listaFeeds[0] || {});\n  const feedListPartnerSamples = listaFeeds\n    .filter((row) => /c&a|renner|ashua|calvin|klein|stanley/i.test(String(row.advertiser_name || "")))\n    .slice(0, 30)\n    .map((row) => ({\n      advertiser_id: row.advertiser_id || null,\n      advertiser_name: row.advertiser_name || null,\n      primary_region: row.primary_region || null,\n      membership_status: row.membership_status || null,\n      feed_id: row.feed_id || null,\n      feed_name: row.feed_name || null,\n      language: row.language || null,\n      no_of_products: row.no_of_products || null,\n    }));\n  console.log(`;

if (codigo.includes(pontoLista)) {
  codigo = codigo.replace(pontoLista, listaComDiagnostico);
}

const pontoResultado = `feeds_acessiveis_total: listaFeeds.length,\n    desconto_minimo:`;
const resultadoComDiagnostico = `feeds_acessiveis_total: listaFeeds.length,\n    feed_list_headers: feedListHeaders,\n    feed_list_partner_samples: feedListPartnerSamples,\n    desconto_minimo:`;

if (codigo.includes(pontoResultado)) {
  codigo = codigo.replace(pontoResultado, resultadoComDiagnostico);
}

fs.writeFileSync(temporario, codigo, "utf8");

try {
  const resultado = spawnSync(process.execPath, [temporario, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  try {
    fs.unlinkSync(temporario);
  } catch {}
}
