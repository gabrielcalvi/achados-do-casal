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

const pontoLista = `const listaFeeds = await buscarListaFeeds();\n  console.log(`;
const listaComDiagnostico = `const listaFeeds = await buscarListaFeeds();\n  const feedListHeaders = Object.keys(listaFeeds[0] || {});\n  console.log(`;

if (codigo.includes(pontoLista)) {
  codigo = codigo.replace(pontoLista, listaComDiagnostico);
}

const pontoResultado = `feeds_acessiveis_total: listaFeeds.length,\n    desconto_minimo:`;
const resultadoComDiagnostico = `feeds_acessiveis_total: listaFeeds.length,\n    feed_list_headers: feedListHeaders,\n    desconto_minimo:`;

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
