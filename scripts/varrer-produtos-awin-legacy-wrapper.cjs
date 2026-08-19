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

const blocoDescontoOriginal = `  if (!precoOriginal || precoOriginal.moeda !== "BRL") return null;\n  if (precoAtual.valor >= precoOriginal.valor) return null;\n\n  const economia = precoOriginal.valor - precoAtual.valor;\n  const percentual = Math.round((economia / precoOriginal.valor) * 1000) / 10;\n  if (percentual < DESCONTO_MINIMO) return null;`;

const blocoDescontoCatalogo = `  const catalogoSemDesconto = new Set(\n    String(process.env.AWIN_PRODUTOS_CATALOGO_LOJAS || \"\")\n      .split(\",\")\n      .map((slug) => slug.trim())\n      .filter(Boolean)\n  ).has(loja.slug);\n\n  let economia = 0;\n  let percentual = 0;\n  let precoOriginalFinal = null;\n\n  if (precoOriginal && precoOriginal.moeda === \"BRL\" && precoAtual.valor < precoOriginal.valor) {\n    economia = precoOriginal.valor - precoAtual.valor;\n    percentual = Math.round((economia / precoOriginal.valor) * 1000) / 10;\n    if (percentual < DESCONTO_MINIMO) return null;\n    precoOriginalFinal = precoOriginal;\n  } else if (!catalogoSemDesconto) {\n    return null;\n  }`;

if (!codigo.includes(blocoDescontoOriginal)) {
  throw new Error("Bloco de desconto do coletor Legacy não encontrado.");
}
codigo = codigo.replace(blocoDescontoOriginal, blocoDescontoCatalogo);
codigo = codigo.replace(
  `precoOriginal: Math.round(precoOriginal.valor * 100) / 100,`,
  `precoOriginal: precoOriginalFinal ? Math.round(precoOriginalFinal.valor * 100) / 100 : null,`,
);

codigo = codigo.replace(
  `descricao: produto.descricao || \`${"${produto.percentual}"}% OFF em produto selecionado na ${"${lojaConfig.nome}"}.\`,`,
  `descricao: produto.descricao || (produto.percentual > 0 ? \`${"${produto.percentual}"}% OFF em produto selecionado na ${"${lojaConfig.nome}"}.\` : \`Produto selecionado no catálogo oficial da ${"${lojaConfig.nome}"}.\`),`,
);
codigo = codigo.replace(
  `desconto_percentual: produto.percentual,`,
  `desconto_percentual: produto.percentual > 0 ? produto.percentual : null,`,
);
codigo = codigo.replace(
  `valor_desconto: produto.economia,`,
  `valor_desconto: produto.economia > 0 ? produto.economia : null,`,
);
codigo = codigo.replace(
  `selos: ["Oferta via Awin", \`${"${produto.percentual}"}% OFF\`],`,
  `selos: produto.percentual > 0 ? ["Oferta via Awin", \`${"${produto.percentual}"}% OFF\`] : ["Produto via Awin"],`,
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
