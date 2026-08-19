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
  "Math.min(120, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
);

const marcadorLeitura = "async function lerFeedLegacy(loja, feeds) {";
const helperMix = `function grupoNike(produto) {
  const conteudo = \`\${produto?.titulo || ""} \${produto?.categoria || ""}\`
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();

  if (/(tenis|sneaker)/i.test(conteudo)) return "tenis";
  if (/(chuteira)/i.test(conteudo)) return "chuteiras";
  if (/(camiseta|camisa|regata|short|calca|moletom|jaqueta|top|vestido)/i.test(conteudo)) return "roupas";
  if (/(mochila|bolsa)/i.test(conteudo)) return "mochilas";
  if (/(bola)/i.test(conteudo)) return "bolas";
  if (/(chinelo|sandalia)/i.test(conteudo)) return "chinelos";
  return "outros";
}

function selecionarMixNike(top) {
  const limiteGrupo = Math.max(10, Math.ceil(LIMITE_POR_LOJA * 0.35));
  const contagem = new Map();
  const selecionados = [];

  for (const produto of top) {
    const grupo = grupoNike(produto);
    const usados = contagem.get(grupo) || 0;
    if (usados >= limiteGrupo) continue;

    selecionados.push(produto);
    contagem.set(grupo, usados + 1);
    if (selecionados.length >= LIMITE_POR_LOJA) break;
  }

  if (selecionados.length < LIMITE_POR_LOJA) {
    const ids = new Set(selecionados.map((produto) => produto.id));
    selecionados.push(
      ...top.filter((produto) => !ids.has(produto.id)).slice(0, LIMITE_POR_LOJA - selecionados.length),
    );
  }

  return selecionados
    .sort((a, b) => {
      const descontoA = Number(a.percentual) || 0;
      const descontoB = Number(b.percentual) || 0;
      if (descontoA !== descontoB) return descontoB - descontoA;
      return (Number(b.economia) || 0) - (Number(a.economia) || 0);
    })
    .slice(0, LIMITE_POR_LOJA);
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
      NIKE_AWIN_LIMITE_PRODUTOS: process.env.NIKE_AWIN_LIMITE_PRODUTOS || "80",
      NIKE_AWIN_DESCONTO_MINIMO: process.env.NIKE_AWIN_DESCONTO_MINIMO || "10",
    },
    stdio: "inherit",
  });

  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  fs.writeFileSync(legacy, original, "utf8");
}
