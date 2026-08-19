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
  "Math.min(120, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
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

const marcadorLeitura = "async function lerFeedLegacy(loja, feeds) {";
const helperCea = `function textoCea(produto) {\n  return \`${"${produto?.categoria || \"\"} ${produto?.titulo || \"\"}"}\`\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\")\n    .toLowerCase();\n}\n\nfunction grupoCea(produto) {\n  const t = textoCea(produto);\n  if (/(infantil|bebe|bebê|menina|menino|kids|baby)/i.test(t)) return \"infantil\";\n  if (/(calcado|calçado|sapato|sandalia|sandália|tenis|tênis|bota|chinelo)/i.test(t)) return \"calcados\";\n  if (/(beleza|maquiagem|perfume|cosmetico|cosmético|cabelo|unha|corpo e banho)/i.test(t)) return \"beleza\";\n  if (/(feminina|feminino|mulher|vestido|saia|sutia|sutiã|lingerie)/i.test(t)) return \"feminino\";\n  if (/(masculina|masculino|homem)/i.test(t)) return \"masculino\";\n  if (/(acessorio|acessório|bolsa|mochila|cinto|bone|boné|gorro|luva|oculos|óculos)/i.test(t)) return \"acessorios\";\n  return \"outros\";\n}\n\nfunction faixaPrecoCea(produto) {\n  const p = Number(produto?.precoOferta) || 0;\n  if (p >= 300) return \"300mais\";\n  if (p >= 150) return \"150a299\";\n  if (p >= 80) return \"80a149\";\n  if (p >= 30) return \"30a79\";\n  return \"ate29\";\n}\n\nfunction chavePoolCea(produto) {\n  return \`${"${grupoCea(produto)}|${faixaPrecoCea(produto)}"}\`;\n}\n\nfunction inserirPoolCea(lista, produto) {\n  const similar = chaveSimilar(produto);\n  if (lista.some((item) => chaveSimilar(item) === similar)) return;\n\n  const chave = chavePoolCea(produto);\n  const mesmoBucket = lista.filter((item) => chavePoolCea(item) === chave);\n  if (mesmoBucket.length < 45) {\n    lista.push(produto);\n    return;\n  }\n\n  const candidatos = lista\n    .map((item, index) => ({ item, index }))\n    .filter(({ item }) => chavePoolCea(item) === chave)\n    .sort((a, b) => (Number(a.item.precoOferta) || 0) - (Number(b.item.precoOferta) || 0));\n\n  const menor = candidatos[0];\n  if (menor && (Number(produto.precoOferta) || 0) > (Number(menor.item.precoOferta) || 0)) {\n    lista[menor.index] = produto;\n  }\n}\n\nfunction selecionarMixCea(lista) {\n  const grupos = [\"feminino\", \"infantil\", \"masculino\", \"calcados\", \"beleza\", \"acessorios\", \"outros\"];\n  const faixas = [\"300mais\", \"150a299\", \"80a149\", \"30a79\", \"ate29\"];\n  const buckets = new Map();\n\n  for (const produto of lista) {\n    const chave = chavePoolCea(produto);\n    if (!buckets.has(chave)) buckets.set(chave, []);\n    buckets.get(chave).push(produto);\n  }\n\n  for (const produtos of buckets.values()) {\n    produtos.sort((a, b) => (Number(b.precoOferta) || 0) - (Number(a.precoOferta) || 0));\n  }\n\n  const selecionados = [];\n  const usados = new Set();\n  let avancou = true;\n\n  while (selecionados.length < LIMITE_POR_LOJA && avancou) {\n    avancou = false;\n    for (const grupo of grupos) {\n      for (const faixa of faixas) {\n        const bucket = buckets.get(\`${"${grupo}|${faixa}"}\`) || [];\n        const produto = bucket.find((item) => !usados.has(item.id));\n        if (!produto) continue;\n        selecionados.push(produto);\n        usados.add(produto.id);\n        avancou = true;\n        if (selecionados.length >= LIMITE_POR_LOJA) break;\n      }\n      if (selecionados.length >= LIMITE_POR_LOJA) break;\n    }\n  }\n\n  if (selecionados.length < LIMITE_POR_LOJA) {\n    const restantes = lista\n      .filter((produto) => !usados.has(produto.id))\n      .sort((a, b) => (Number(b.precoOferta) || 0) - (Number(a.precoOferta) || 0));\n    selecionados.push(...restantes.slice(0, LIMITE_POR_LOJA - selecionados.length));\n  }\n\n  return selecionados.slice(0, LIMITE_POR_LOJA);\n}\n\n${marcadorLeitura}`;

if (!codigo.includes(marcadorLeitura)) {
  throw new Error("Marcador de leitura do feed não encontrado.");
}
codigo = codigo.replace(marcadorLeitura, helperCea);

codigo = codigo.replace(
  `inserirTop(top, produto);`,
  `loja.slug === "cea" ? inserirPoolCea(top, produto) : inserirTop(top, produto);`,
);

codigo = codigo.replace(
  `selecionados: top.slice(0, LIMITE_POR_LOJA),`,
  `selecionados: loja.slug === "cea" ? selecionarMixCea(top) : top.slice(0, LIMITE_POR_LOJA),`,
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
