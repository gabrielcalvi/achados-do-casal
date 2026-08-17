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
const colunasDiretoAtuais = `["merchant_deep_link", "deep_link", "merchant_link", "product_url"]`;
const colunasImagemAntigas = `["merchant_image_url", "large_image", "aw_image_url", "merchant_thumb_url"]`;
const colunasImagemAtuais = `["merchant_image_url", "image_url", "large_image", "aw_image_url", "merchant_thumb_url", "merchant_thumb"]`;

if (!codigo.includes(colunasDiretoAntigas) || !codigo.includes(colunasImagemAntigas)) {
  throw new Error("Não foi possível localizar as colunas de produto do coletor Legacy.");
}

codigo = codigo
  .replace(colunasDiretoAntigas, colunasDiretoAtuais)
  .replace(colunasImagemAntigas, colunasImagemAtuais);

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
