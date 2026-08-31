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
if (!codigo.includes(filtroLojas)) throw new Error("Nao foi possivel isolar a KaBuM no coletor Legacy.");
codigo = codigo.replace(filtroLojas, filtroKabum);

const limiteBase = `Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))`;
const limiteAmpliado = `Math.min(160, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))`;
if (codigo.includes(limiteBase)) codigo = codigo.replace(limiteBase, limiteAmpliado);

const filtroMembership = `return !status || status.includes("joined") || status.includes("aprov");`;
const filtroMembershipKabum = `return !status || status.includes("joined") || status.includes("aprov") || status.includes("active") || status.includes("ativo");`;
if (codigo.includes(filtroMembership)) codigo = codigo.replace(filtroMembership, filtroMembershipKabum);

const normalizacaoAntiga = `.replace(/^\\uFEFF/, "")\n    .normalize("NFD")`;
const normalizacaoNova = `.replace(/^\\uFEFF/, "")\n    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")\n    .normalize("NFD")`;
if (codigo.includes(normalizacaoAntiga)) codigo = codigo.replace(normalizacaoAntiga, normalizacaoNova);

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
  )
  .replace(
    `["rrp_price", "product_price_old", "old_price", "was_price"]`,
    `["rrp_price", "product_price_old", "old_price", "was_price", "regular_price", "list_price"]`,
  )
  .replace(
    `const STATUS_FILE = "/vercel/tmp/awin-produtos-status.json";`,
    `const STATUS_FILE = "/vercel/tmp/awin-kabum-produtos-status.json";`,
  )
  .replace(
    `const RESULT_FILE = "/vercel/tmp/awin-produtos-resultado.json";`,
    `const RESULT_FILE = "/vercel/tmp/awin-kabum-produtos-resultado.json";`,
  );

const blocoDesconto = `  if (!precoOriginal || precoOriginal.moeda !== "BRL") return null;\n  if (precoAtual.valor >= precoOriginal.valor) return null;\n\n  const economia = precoOriginal.valor - precoAtual.valor;\n  const percentual = Math.round((economia / precoOriginal.valor) * 1000) / 10;\n  if (percentual < DESCONTO_MINIMO) return null;`;

const blocoCatalogo = `  let economia = 0;\n  let percentual = 0;\n  let precoOriginalFinal = null;\n\n  if (precoOriginal && precoOriginal.moeda === "BRL" && precoAtual.valor < precoOriginal.valor) {\n    economia = precoOriginal.valor - precoAtual.valor;\n    percentual = Math.round((economia / precoOriginal.valor) * 1000) / 10;\n    if (percentual > 0 && percentual < DESCONTO_MINIMO) {\n      percentual = 0;\n      economia = 0;\n    } else if (percentual >= DESCONTO_MINIMO) {\n      precoOriginalFinal = precoOriginal;\n    }\n  }`;

if (!codigo.includes(blocoDesconto)) {
  throw new Error("Bloco de desconto do coletor KaBuM nao encontrado.");
}
codigo = codigo.replace(blocoDesconto, blocoCatalogo);
codigo = codigo.replace(
  `precoOriginal: Math.round(precoOriginal.valor * 100) / 100,`,
  `precoOriginal: precoOriginalFinal ? Math.round(precoOriginalFinal.valor * 100) / 100 : null,`,
);

const marcadorLeitura = "async function lerFeedLegacy(loja, feeds) {";
const helperMix = `function grupoKabum(produto) {\n  const t = \`${"${produto?.titulo || \"\"} ${produto?.categoria || \"\"}"}\`\n    .normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .toLowerCase();\n  if (/(notebook|laptop)/.test(t)) return "notebooks";\n  if (/(monitor|display)/.test(t)) return "monitores";\n  if (/(placa de video|gpu|rtx|radeon)/.test(t)) return "gpu";\n  if (/(processador|cpu|ryzen|intel core)/.test(t)) return "processadores";\n  if (/(ssd|hd |hard disk|armazenamento)/.test(t)) return "armazenamento";\n  if (/(memoria|ram)/.test(t)) return "memoria";\n  if (/(mouse|teclado|headset|fone|cadeira gamer|controle)/.test(t)) return "perifericos";\n  if (/(smartphone|celular|iphone|galaxy)/.test(t)) return "celulares";\n  if (/(tv|televisor|smart tv)/.test(t)) return "tv";\n  return "outros";\n}\n\nfunction faixaKabum(produto) {\n  const p = Number(produto?.precoOferta) || 0;\n  if (p >= 3000) return "3000mais";\n  if (p >= 1500) return "1500a2999";\n  if (p >= 700) return "700a1499";\n  if (p >= 300) return "300a699";\n  return "ate299";\n}\n\nfunction selecionarMixKabum(lista) {\n  const grupos = ["notebooks","monitores","gpu","processadores","armazenamento","memoria","perifericos","celulares","tv","outros"];\n  const faixas = ["3000mais","1500a2999","700a1499","300a699","ate299"];\n  const buckets = new Map();\n  for (const produto of lista) {\n    const chave = \`${"${grupoKabum(produto)}|${faixaKabum(produto)}"}\`;\n    if (!buckets.has(chave)) buckets.set(chave, []);\n    buckets.get(chave).push(produto);\n  }\n  for (const itens of buckets.values()) {\n    itens.sort((a,b) => (Number(b.percentual)||0)-(Number(a.percentual)||0) || (Number(b.precoOferta)||0)-(Number(a.precoOferta)||0));\n  }\n  const selecionados=[];\n  const usados=new Set();\n  let avancou=true;\n  while (selecionados.length<LIMITE_POR_LOJA && avancou) {\n    avancou=false;\n    for (const grupo of grupos) {\n      for (const faixa of faixas) {\n        const bucket=buckets.get(\`${"${grupo}|${faixa}"}\`)||[];\n        const produto=bucket.find((item)=>!usados.has(item.id));\n        if (!produto) continue;\n        selecionados.push(produto);\n        usados.add(produto.id);\n        avancou=true;\n        if (selecionados.length>=LIMITE_POR_LOJA) break;\n      }\n      if (selecionados.length>=LIMITE_POR_LOJA) break;\n    }\n  }\n  if (selecionados.length<LIMITE_POR_LOJA) {\n    const restantes=lista.filter((p)=>!usados.has(p.id)).sort((a,b)=>(Number(b.percentual)||0)-(Number(a.percentual)||0)||(Number(b.precoOferta)||0)-(Number(a.precoOferta)||0));\n    selecionados.push(...restantes.slice(0,LIMITE_POR_LOJA-selecionados.length));\n  }\n  return selecionados.slice(0,LIMITE_POR_LOJA);\n}\n\n${marcadorLeitura}`;

if (!codigo.includes(marcadorLeitura)) throw new Error("Marcador de leitura KaBuM nao encontrado.");
codigo = codigo.replace(marcadorLeitura, helperMix);
codigo = codigo.replace(
  `selecionados: top.slice(0, LIMITE_POR_LOJA),`,
  `selecionados: loja.slug === "kabum" ? selecionarMixKabum(top) : top.slice(0, LIMITE_POR_LOJA),`,
);

// A API batch do Link Builder da AWIN passou a responder 400 para o anunciante,
// apesar de o feed e a parceria estarem ativos. Usa o formato oficial de tracking
// direto da AWIN, com advertiser + publisher + destino, evitando depender do batch.
const marcadorLinks = "async function gerarLinksAfiliados(loja, produtos) {";
const helperLinksKabum = `function linkAfiliadoKabumDireto(loja, destino) {\n  const params = new URLSearchParams({\n    awinmid: String(loja.advertiserId),\n    awinaffid: PUBLISHER_ID,\n    campaign: "achados-economize-produtos",\n    ued: destino,\n    platform: "pl",\n  });\n  return \`https://www.awin1.com/cread.php?\${params.toString()}\`;\n}\n\nasync function gerarLinksAfiliados(loja, produtos) {\n  if (loja.slug === "kabum") {\n    const prontosKabum = produtos.map((produto) => ({\n      ...produto,\n      linkAfiliado: linkAfiliadoKabumDireto(loja, produto.link),\n    }));\n    return { produtos: selecionarMixKabum(prontosKabum), falhas: 0, nativos: prontosKabum.length };\n  }`;
if (!codigo.includes(marcadorLinks)) throw new Error("Gerador de links KaBuM nao encontrado.");
codigo = codigo.replace(marcadorLinks, helperLinksKabum);

codigo = codigo.replace(
  `return { produtos: prontos.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA), falhas: 0, nativos: prontos.length };`,
  `return { produtos: loja.slug === "kabum" ? selecionarMixKabum(prontos) : prontos.sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA), falhas: 0, nativos: prontos.length };`,
);
codigo = codigo.replace(
  `produtos: [...prontos, ...gerados].sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),`,
  `produtos: loja.slug === "kabum" ? selecionarMixKabum([...prontos, ...gerados]) : [...prontos, ...gerados].sort(ordenarProdutos).slice(0, LIMITE_POR_LOJA),`,
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
    env: {
      ...process.env,
      AWIN_PRODUTOS_LIMITE_POR_LOJA:
        process.env.KABUM_AWIN_LIMITE_PRODUTOS ||
        process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA ||
        "120",
      AWIN_PRODUTOS_DESCONTO_MINIMO:
        process.env.KABUM_AWIN_DESCONTO_MINIMO ||
        process.env.AWIN_PRODUTOS_DESCONTO_MINIMO ||
        "10",
    },
    stdio: "inherit",
  });

  process.exitCode = Number.isInteger(resultado.status) ? resultado.status : 1;
} finally {
  try { fs.unlinkSync(temporario); } catch {}
}
