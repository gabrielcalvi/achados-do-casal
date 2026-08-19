const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const legacy = path.join(__dirname, "varrer-produtos-awin-legacy.cjs");
const nikeSeguro = path.join(__dirname, "varrer-produtos-awin-nike-seguro.cjs");

if (!fs.existsSync(legacy) || !fs.existsSync(nikeSeguro)) {
  throw new Error("Scripts AWIN Nike nao encontrados.");
}

const original = fs.readFileSync(legacy, "utf8");
let codigo = original;

codigo = codigo.replace(
  "Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
  "Math.min(50, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
);

const marcadorLeitura = "async function lerFeedLegacy(loja, feeds) {";
const helperMix = `function produtoEhCalcadoNike(produto) {
  const conteudo = \`\${produto?.titulo || ""} \${produto?.categoria || ""}\`
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();
  return /(calcado|calcados|tenis|chuteira|sapatilha|shoe|shoes|sneaker)/i.test(conteudo);
}

function selecionarMixNike(top) {
  const minimoCalcados = Math.min(15, LIMITE_POR_LOJA);
  const calcados = top.filter(produtoEhCalcadoNike);
  const variados = top.filter((produto) => !produtoEhCalcadoNike(produto));
  const selecionados = [];

  selecionados.push(...calcados.slice(0, minimoCalcados));
  selecionados.push(...variados.slice(0, Math.max(0, LIMITE_POR_LOJA - selecionados.length)));

  if (selecionados.length < LIMITE_POR_LOJA) {
    const usados = new Set(selecionados.map((produto) => produto.id));
    selecionados.push(
      ...top.filter((produto) => !usados.has(produto.id)).slice(0, LIMITE_POR_LOJA - selecionados.length),
    );
  }

  return selecionados.slice(0, LIMITE_POR_LOJA);
}

${marcadorLeitura}`;

if (!codigo.includes(marcadorLeitura)) {
  throw new Error("Nao foi possivel inserir o mix Nike.");
}

codigo = codigo.replace(marcadorLeitura, helperMix);

const marcadorSelecao = "selecionados: top.slice(0, LIMITE_POR_LOJA),";
if (!codigo.includes(marcadorSelecao)) {
  throw new Error("Nao foi possivel aplicar o mix Nike na selecao final.");
}

codigo = codigo.replace(
  marcadorSelecao,
  'selecionados: loja.slug === "nike" ? selecionarMixNike(top) : top.slice(0, LIMITE_POR_LOJA),',
);

fs.writeFileSync(legacy, codigo, "utf8");

try {
  const resultado = spawnSync(process.execPath, [nikeSeguro, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NIKE_AWIN_LIMITE_PRODUTOS: process.env.NIKE_AWIN_LIMITE_PRODUTOS || "40",
    },
    stdio: "inherit",
  });

  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  fs.writeFileSync(legacy, original, "utf8");
}
