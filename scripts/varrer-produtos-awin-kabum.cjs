const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const origem = path.join(__dirname, "varrer-produtos-awin-legacy.cjs");
const temporario = path.join(__dirname, ".varrer-produtos-awin-kabum-temp.cjs");

if (!fs.existsSync(origem)) {
  throw new Error(`Coletor Legacy nao encontrado: ${origem}`);
}

let codigo = fs.readFileSync(origem, "utf8");

const filtroLojas = `["cea", "renner", "calvin-klein", "stanley", "casas-bahia"].includes(loja.slug)`;
const filtroKabum = `["kabum"].includes(loja.slug)`;

if (!codigo.includes(filtroLojas)) {
  throw new Error("Nao foi possivel isolar a KaBuM no coletor Legacy.");
}

codigo = codigo.replace(filtroLojas, filtroKabum);

const limiteBase = `Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))`;
const limiteAmpliado = `Math.min(120, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))`;
if (codigo.includes(limiteBase)) {
  codigo = codigo.replace(limiteBase, limiteAmpliado);
}

const filtroMembership = `return !status || status.includes("joined") || status.includes("aprov");`;
const filtroMembershipKabum = `return !status || status.includes("joined") || status.includes("aprov") || status.includes("active") || status.includes("ativo");`;
if (codigo.includes(filtroMembership)) {
  codigo = codigo.replace(filtroMembership, filtroMembershipKabum);
}

codigo = codigo
  .replace(
    `const STATUS_FILE = "/vercel/tmp/awin-produtos-status.json";`,
    `const STATUS_FILE = "/vercel/tmp/awin-kabum-produtos-status.json";`
  )
  .replace(
    `const RESULT_FILE = "/vercel/tmp/awin-produtos-resultado.json";`,
    `const RESULT_FILE = "/vercel/tmp/awin-kabum-produtos-resultado.json";`
  );

fs.writeFileSync(temporario, codigo, "utf8");

try {
  const resultado = spawnSync(process.execPath, [temporario, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AWIN_PRODUTOS_LIMITE_POR_LOJA:
        process.env.KABUM_AWIN_LIMITE_PRODUTOS ||
        process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA ||
        "80",
      AWIN_PRODUTOS_DESCONTO_MINIMO:
        process.env.KABUM_AWIN_DESCONTO_MINIMO ||
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
