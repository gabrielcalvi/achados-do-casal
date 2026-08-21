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
  "Math.min(220, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))",
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
const helperCea = `function textoCea(produto) {\n  return \`${"${produto?.categoria || \"\"} ${produto?.titulo || \"\"}"}\`\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\")\n    .toLowerCase();\n}\n\nfunction grupoCea(produto) {\n  const t = textoCea(produto);\n  if (/(infantil|bebe|menina|menino|kids|baby)/i.test(t)) return \"infantil\";\n  if (/(calcado|sapato|sandalia|tenis|bota|chinelo|sapatilha)/i.test(t)) return \"calcados\";\n  if (/(beleza|maquiagem|perfume|cosmetico|cabelo|unha|corpo e banho)/i.test(t)) return \"beleza\";\n  if (/(feminina|feminino|mulher|vestido|saia|sutia|lingerie|blusa|cropped)/i.test(t)) return \"feminino\";\n  if (/(masculina|masculino|homem|polo)/i.test(t)) return \"masculino\";\n  if (/(acessorio|bolsa|mochila|cinto|bone|gorro|luva|oculos|carteira)/i.test(t)) return \"acessorios\";\n  return \"outros\";\n}\n\nfunction categoriaPublicaCea(produto) {\n  const grupo = grupoCea(produto);\n  return ({\n    feminino: \"Feminino\",\n    infantil: \"Infantil\",\n    masculino: \"Masculino\",\n    calcados: \"Calçados\",\n    beleza: \"Beleza\",\n    acessorios: \"Acessórios\",\n    outros: \"Moda e lifestyle\",\n  })[grupo] || \"Moda e lifestyle\";\n}\n\nfunction faixaPrecoCea(produto) {\n  const p = Number(produto?.precoOferta) || 0;\n  if (p >= 150) return \"150mais\";\n  if (p >= 100) return \"100a149\";\n  if (p >= 70) return \"70a99\";\n  if (p >= 50) return \"50a69\";\n  if (p >= 30) return \"30a49\";\n  if (p >= 20) return \"20a29\";\n  if (p >= 10) return \"10a19\";\n  return \"ate9\";\n}\n\nfunction chavePoolCea(produto) {\n  return \`${"${grupoCea(produto)}|${faixaPrecoCea(produto)}"}\`;\n}\n\nfunction faixaBarataCea(faixa) {\n  return faixa === \"ate9\" || faixa === \"10a19\" || faixa === \"20a29\";\n}\n\nfunction inserirPoolCea(lista, produto) {\n  const similar = chaveSimilar(produto);\n  if (lista.some((item) => chaveSimilar(item) === similar)) return;\n\n  const chave = chavePoolCea(produto);\n  const faixa = faixaPrecoCea(produto);\n  const mesmoBucket = lista.filter((item) => chavePoolCea(item) === chave);\n  if (mesmoBucket.length < 80) {\n    lista.push(produto);\n    return;\n  }\n\n  const candidatos = lista\n    .map((item, index) => ({ item, index }))\n    .filter(({ item }) => chavePoolCea(item) === chave)\n    .sort((a, b) => (Number(a.item.precoOferta) || 0) - (Number(b.item.precoOferta) || 0));\n\n  const precoNovo = Number(produto.precoOferta) || 0;\n  if (faixaBarataCea(faixa)) {\n    const maior = candidatos[candidatos.length - 1];\n    if (maior && precoNovo < (Number(maior.item.precoOferta) || 0)) lista[maior.index] = produto;\n    return;\n  }\n\n  const menor = candidatos[0];\n  if (menor && precoNovo > (Number(menor.item.precoOferta) || 0)) lista[menor.index] = produto;\n}\n\nfunction selecionarMixCea(lista) {\n  const grupos = [\"feminino\", \"infantil\", \"masculino\", \"calcados\", \"beleza\", \"acessorios\", \"outros\"];\n  const faixas = [\"ate9\", \"10a19\", \"20a29\", \"30a49\", \"50a69\", \"70a99\", \"100a149\", \"150mais\"];\n  const buckets = new Map();\n\n  for (const produto of lista) {\n    const chave = chavePoolCea(produto);\n    if (!buckets.has(chave)) buckets.set(chave, []);\n    buckets.get(chave).push(produto);\n  }\n\n  for (const [chave, produtos] of buckets.entries()) {\n    const faixa = chave.split(\"|\")[1] || \"\";\n    produtos.sort((a, b) => faixaBarataCea(faixa)\n      ? (Number(a.precoOferta) || 0) - (Number(b.precoOferta) || 0)\n      : (Number(b.precoOferta) || 0) - (Number(a.precoOferta) || 0));\n  }\n\n  const selecionados = [];\n  const usados = new Set();\n  let avancou = true;\n\n  while (selecionados.length < LIMITE_POR_LOJA && avancou) {\n    avancou = false;\n    for (const faixa of faixas) {\n      for (const grupo of grupos) {\n        const bucket = buckets.get(\`${"${grupo}|${faixa}"}\`) || [];\n        const produto = bucket.find((item) => !usados.has(item.id));\n        if (!produto) continue;\n        selecionados.push(produto);\n        usados.add(produto.id);\n        avancou = true;\n        if (selecionados.length >= LIMITE_POR_LOJA) break;\n      }\n      if (selecionados.length >= LIMITE_POR_LOJA) break;\n    }\n  }\n\n  if (selecionados.length < LIMITE_POR_LOJA) {\n    const restantes = lista\n      .filter((produto) => !usados.has(produto.id))\n      .sort((a, b) => {\n        const faixaA = faixaPrecoCea(a);\n        const faixaB = faixaPrecoCea(b);\n        const baratoA = faixaBarataCea(faixaA) ? 1 : 0;\n        const baratoB = faixaBarataCea(faixaB) ? 1 : 0;\n        if (baratoA !== baratoB) return baratoB - baratoA;\n        if (baratoA) return (Number(a.precoOferta) || 0) - (Number(b.precoOferta) || 0);\n        return (Number(b.precoOferta) || 0) - (Number(a.precoOferta) || 0);\n      });\n    selecionados.push(...restantes.slice(0, LIMITE_POR_LOJA - selecionados.length));\n  }\n\n  return selecionados.slice(0, LIMITE_POR_LOJA);\n}\n\n${marcadorLeitura}`;

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

const marcadorLinks = "async function gerarLinksAfiliados(loja, produtos) {";
const helperLinksCea = `function linkAfiliadoCeaDireto(loja, destino) {\n  const params = new URLSearchParams({\n    awinmid: String(loja.advertiserId),\n    awinaffid: PUBLISHER_ID,\n    campaign: \"achados-economize-produtos\",\n    ued: destino,\n    platform: \"pl\",\n  });\n  return \`https://www.awin1.com/cread.php?${"${params.toString()}"}\`;\n}\n\nasync function gerarLinksAfiliados(loja, produtos) {\n  if (loja.slug === \"cea\") {\n    const prontosCea = produtos.map((produto) => ({\n      ...produto,\n      linkAfiliado: linkAfiliadoCeaDireto(loja, produto.link),\n    }));\n    return {\n      produtos: selecionarMixCea(prontosCea),\n      falhas: 0,\n      nativos: prontosCea.length,\n    };\n  }`;

if (!codigo.includes(marcadorLinks)) {
  throw new Error("Gerador de links afiliados não encontrado.");
}
codigo = codigo.replace(marcadorLinks, helperLinksCea);

codigo = codigo.replace(
  `return { produtos: prontos.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA), falhas: 0, nativos: prontos.length };`,
  `return { produtos: loja.slug === "cea" ? selecionarMixCea(prontos) : prontos.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA), falhas: 0, nativos: prontos.length };`,
);

codigo = codigo.replace(
  `produtos: [...prontos, ...gerados].sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),`,
  `produtos: loja.slug === "cea" ? selecionarMixCea([...prontos, ...gerados]) : [...prontos, ...gerados].sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),`,
);

codigo = codigo.replace(
  `descricao: produto.descricao || \`${"${produto.percentual}"}% OFF em produto selecionado na ${"${lojaConfig.nome}"}.\`,`,
  `descricao: produto.descricao || (produto.percentual > 0 ? \`${"${produto.percentual}"}% OFF em produto selecionado na ${"${lojaConfig.nome}"}.\` : \`Produto selecionado no catálogo oficial da ${"${lojaConfig.nome}"}.\`),`,
);
codigo = codigo.replace(
  `categoria: produto.categoria,`,
  `categoria: lojaConfig.slug === "cea" ? categoriaPublicaCea(produto) : produto.categoria,`,
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
