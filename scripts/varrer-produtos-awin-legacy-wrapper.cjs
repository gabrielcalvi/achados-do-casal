const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const origem = path.join(__dirname, "varrer-produtos-awin-legacy.cjs");
const temporario = path.join(__dirname, ".varrer-produtos-awin-legacy-normalizado.cjs");

if (!fs.existsSync(origem)) {
  throw new Error(`Coletor Legacy não encontrado: ${origem}`);
}

let codigo = fs.readFileSync(origem, "utf8");

codigo = codigo.replace(
  "Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
  "Math.min(60, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
);

codigo = codigo.replace(
  `const lojas = lojasConfig.filter(\n  (loja) =>\n    !loja.monitorOnly &&\n    [\"cea\", \"renner\", \"calvin-klein\", \"stanley\", \"casas-bahia\"].includes(loja.slug)\n);`,
  `const lojasPermitidas = new Set(\n  String(process.env.AWIN_PRODUTOS_LOJAS || \"cea,renner,calvin-klein,stanley,casas-bahia\")\n    .split(\",\")\n    .map((slug) => slug.trim())\n    .filter(Boolean)\n);\n\nconst lojas = lojasConfig.filter(\n  (loja) => !loja.monitorOnly && lojasPermitidas.has(loja.slug)\n);`,
);

codigo = codigo.replace(
  `.replace(/^\\uFEFF/, "")\n    .normalize("NFD")`,
  `.replace(/^\\uFEFF/, "")\n    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")\n    .normalize("NFD")`,
);

codigo = codigo.replace(
  `return !status || status.includes("joined") || status.includes("aprov");`,
  `return !status || status === "active" || status.includes("joined") || status.includes("aprov");`,
);

codigo = codigo
  .replace(
    `["merchant_deep_link", "merchant_link", "product_url"]`,
    `["merchant_deep_link", "merchant_link", "product_url", "deep_link"]`,
  )
  .replace(
    `["merchant_image_url", "large_image", "aw_image_url", "merchant_thumb_url"]`,
    `["merchant_image_url", "image_url", "image_link", "large_image", "aw_image_url", "merchant_thumb_url", "merchant_thumb"]`,
  )
  .replace(
    `["search_price", "store_price", "base_price", "price"]`,
    `["search_price", "store_price", "base_price", "price", "sale_price"]`,
  );

fs.writeFileSync(temporario, codigo, "utf8");

try {
  const resultado = spawnSync(process.execPath, [temporario, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  try { fs.unlinkSync(temporario); } catch {}
}
