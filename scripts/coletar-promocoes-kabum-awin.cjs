const fs = require("fs");
const path = require("path");

const PUBLISHER_ID = 2922231;
const ADVERTISER_ID = 17729;

function carregarEnvLocal() {
  const arquivo = path.join(
    process.cwd(),
    ".env.local"
  );

  if (!fs.existsSync(arquivo)) {
    throw new Error(".env.local nao encontrado.");
  }

  const linhas = fs
    .readFileSync(arquivo, "utf8")
    .split(/\r?\n/);

  for (const original of linhas) {
    const linha = original.trim();

    if (!linha || linha.startsWith("#")) {
      continue;
    }

    const i = linha.indexOf("=");

    if (i < 1) continue;

    const chave = linha
      .slice(0, i)
      .trim()
      .replace(/^\uFEFF/, "");

    let valor = linha
      .slice(i + 1)
      .trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

function encontrarLista(json) {
  if (Array.isArray(json)) {
    return json;
  }

  const chaves = [
    "offers",
    "promotions",
    "items",
    "results",
    "data",
  ];

  for (const chave of chaves) {
    if (Array.isArray(json?.[chave])) {
      return json[chave];
    }
  }

  for (const valor of Object.values(json || {})) {
    if (Array.isArray(valor)) {
      return valor;
    }
  }

  return [];
}

async function buscarPagina(token, pagina) {
  const corpo = {
    filters: {
      advertiserIds: [ADVERTISER_ID],
      membership: "joined",
      regionCodes: ["BR"],
      status: "active",
      type: "promotion",
    },

    pagination: {
      page: pagina,
      pageSize: 200,
    },
  };

  const resposta = await fetch(
    `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(corpo),
    }
  );

  const texto = await resposta.text();

  let json;

  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error(
      `Awin respondeu conteudo nao JSON. HTTP ${resposta.status}: ${texto.slice(0, 300)}`
    );
  }

  if (!resposta.ok) {
    throw new Error(
      `Awin HTTP ${resposta.status}: ${texto.slice(0, 500)}`
    );
  }

  return json;
}

function tipoDestino(url) {
  const texto = String(url || "");

  if (/kabum\.com\.br\/produto\//i.test(texto)) {
    return "produto";
  }

  if (/kabum\.com\.br\/promocao\//i.test(texto)) {
    return "promocao";
  }

  return "categoria_ou_pagina";
}

function ehGpu(item) {
  const texto = [
    item.title,
    item.description,
    item.campaign,
    item.url,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    /placa\s+de\s+v[ií]deo/i.test(texto) ||
    /\bgeforce\b/i.test(texto) ||
    /\bradeon\b/i.test(texto) ||
    /\brtx\s*\d+/i.test(texto) ||
    /\brx\s*\d{3,4}/i.test(texto) ||
    /\bgpu\b/i.test(texto)
  );
}

function dataValida(valor) {
  const n = Date.parse(valor || "");

  return Number.isFinite(n)
    ? n
    : null;
}

async function main() {
  carregarEnvLocal();

  const token =
    process.env.AWIN_API_TOKEN;

  if (!token) {
    throw new Error(
      "AWIN_API_TOKEN nao encontrado no .env.local."
    );
  }

  let pagina = 1;
  let totalApi = null;

  const todos = [];

  while (true) {
    process.stdout.write(
      `Lendo pagina ${pagina}... `
    );

    const json =
      await buscarPagina(
        token,
        pagina
      );

    const itens =
      encontrarLista(json);

    const total =
      Number(
        json?.pagination?.total
      );

    if (
      Number.isFinite(total)
    ) {
      totalApi = total;
    }

    console.log(
      `${itens.length} registros`
    );

    if (!itens.length) {
      break;
    }

    todos.push(...itens);

    if (
      totalApi !== null &&
      todos.length >= totalApi
    ) {
      break;
    }

    pagina += 1;

    if (pagina > 50) {
      throw new Error(
        "Limite de seguranca de paginas atingido."
      );
    }
  }

  const agora =
    Date.now();

  const diaAtras =
    agora -
    24 * 60 * 60 * 1000;

  const validas =
    todos
      .filter((item) => {
        if (
          item.type !== "promotion"
        ) {
          return false;
        }

        if (
          Number(item.advertiser?.id) !==
          ADVERTISER_ID
        ) {
          return false;
        }

        if (
          item.advertiser?.joined !== true
        ) {
          return false;
        }

        if (!item.urlTracking) {
          return false;
        }

        const inicio =
          dataValida(item.startDate);

        const fim =
          dataValida(item.endDate);

        if (
          inicio !== null &&
          inicio > agora
        ) {
          return false;
        }

        if (
          fim !== null &&
          fim <= agora
        ) {
          return false;
        }

        return true;
      })
      .map((item) => ({
        origem: "awin_kabum",
        loja: "Kabum",

        advertiserId:
          item.advertiser?.id,

        promotionId:
          item.promotionId,

        tipo: "promotion",

        titulo:
          item.title || "",

        descricao:
          item.description || "",

        termos:
          item.terms || "",

        inicio:
          item.startDate || null,

        validade:
          item.endDate || null,

        statusAwin:
          item.status || "",

        linkDestino:
          item.url || "",

        linkAfiliado:
          item.urlTracking || "",

        destinoTipo:
          tipoDestino(item.url),

        adicionadoEm:
          item.dateAdded || null,

        campanha:
          item.campaign || "",

        possivelGpu:
          ehGpu(item),
      }));

  validas.sort(
    (a, b) =>
      (dataValida(b.adicionadoEm) || 0) -
      (dataValida(a.adicionadoEm) || 0)
  );

  const produtos =
    validas.filter(
      (x) =>
        x.destinoTipo === "produto"
    );

  const paginasPromocao =
    validas.filter(
      (x) =>
        x.destinoTipo === "promocao"
    );

  const outras =
    validas.filter(
      (x) =>
        x.destinoTipo ===
        "categoria_ou_pagina"
    );

  const novas24h =
    validas.filter((x) => {
      const data =
        dataValida(x.adicionadoEm);

      return (
        data !== null &&
        data >= diaAtras
      );
    });

  const gpus =
    validas.filter(
      (x) => x.possivelGpu
    );

  const pasta =
    path.join(
      process.cwd(),
      "tmp"
    );

  fs.mkdirSync(
    pasta,
    { recursive: true }
  );

  const saida =
    path.join(
      pasta,
      "promocoes-kabum-awin.json"
    );

  fs.writeFileSync(
    saida,
    JSON.stringify(
      {
        geradoEm:
          new Date().toISOString(),

        resumo: {
          totalApi,
          totalColetado:
            todos.length,

          validasAgora:
            validas.length,

          diretoProduto:
            produtos.length,

          paginasPromocao:
            paginasPromocao.length,

          categoriaOutra:
            outras.length,

          adicionadas24h:
            novas24h.length,

          possiveisGpu:
            gpus.length,
        },

        promocoes:
          validas,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "=== PROMOCOES KABUM / AWIN ==="
  );

  console.log(
    `Total API: ${totalApi ?? todos.length}`
  );

  console.log(
    `Coletadas: ${todos.length}`
  );

  console.log(
    `Validas agora: ${validas.length}`
  );

  console.log(
    `Direto em produto: ${produtos.length}`
  );

  console.log(
    `Paginas promocao: ${paginasPromocao.length}`
  );

  console.log(
    `Categoria/outra: ${outras.length}`
  );

  console.log(
    `Adicionadas ultimas 24h: ${novas24h.length}`
  );

  console.log(
    `Possiveis placas/GPU: ${gpus.length}`
  );

  console.log("");
  console.log(
    "=== MAIS RECENTES ==="
  );

  for (
    const item of
    validas.slice(0, 25)
  ) {
    console.log(
      `${item.promotionId} | ${item.destinoTipo} | ${item.titulo} | ${item.adicionadoEm}`
    );
  }

  console.log("");
  console.log(
    "=== GPU / PLACAS DE VIDEO ==="
  );

  if (!gpus.length) {
    console.log(
      "Nenhuma identificada por titulo nesta coleta."
    );
  } else {
    for (const item of gpus) {
      console.log(
        `${item.promotionId} | ${item.titulo} | ${item.linkDestino}`
      );
    }
  }

  console.log("");
  console.log(
    `JSON salvo em: ${saida}`
  );
}

main().catch((erro) => {
  console.error("");
  console.error(
    "ERRO PROMOCOES KABUM:"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exitCode = 1;
});
