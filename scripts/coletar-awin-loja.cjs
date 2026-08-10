const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const lojas = require("./awin-lojas.config.cjs");

const slug = String(process.argv[2] || "").trim();
const tipo = String(process.argv[3] || "").trim();

if (!slug || !["cupons", "promocoes"].includes(tipo)) {
  console.error(
    "Uso: node coletar-awin-loja.cjs <slug> <cupons|promocoes>"
  );
  process.exit(1);
}

const loja = lojas.find((item) => item.slug === slug);

if (!loja) {
  console.error(`Loja nao configurada: ${slug}`);
  process.exit(1);
}

const baseNome =
  tipo === "cupons"
    ? "coletar-cupons-kabum-awin.cjs"
    : "coletar-promocoes-kabum-awin.cjs";

const basePath = path.join(__dirname, baseNome);

if (!fs.existsSync(basePath)) {
  console.error(`Coletor base nao encontrado: ${basePath}`);
  process.exit(1);
}

let codigo = fs.readFileSync(basePath, "utf8");

const arquivoSaida =
  tipo === "cupons"
    ? `cupons-${loja.slug}-awin.json`
    : `promocoes-${loja.slug}-awin.json`;

codigo = codigo.replaceAll("17729", loja.advertiserId);

codigo = codigo.replaceAll(
  tipo === "cupons"
    ? "cupons-kabum-awin.json"
    : "promocoes-kabum-awin.json",
  arquivoSaida
);

codigo = codigo.replaceAll(
  "awin_kabum",
  `awin_${loja.slug}`
);

codigo = codigo.replaceAll(
  "kabum.com.br",
  loja.dominio
);

codigo = codigo.replaceAll(
  "KaBuM",
  loja.nome
);

codigo = codigo.replaceAll(
  "Kabum",
  loja.nome
);

codigo = codigo.replaceAll(
  "KABUM",
  loja.nome.toUpperCase()
);

const gerado = path.join(
  __dirname,
  `.awin-${loja.slug}-${tipo}-gerado.cjs`
);

try {
  fs.writeFileSync(gerado, codigo, "utf8");

  const resultado = spawnSync(
    process.execPath,
    [gerado],
    {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      stdio: "inherit"
    }
  );

  process.exitCode =
    Number.isInteger(resultado.status)
      ? resultado.status
      : 1;
} finally {
  try {
    fs.unlinkSync(gerado);
  } catch {}
}
