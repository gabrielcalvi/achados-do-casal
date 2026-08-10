const fs = require("fs");
const path = require("path");

function carregarEnvLocal() {
  const arquivo = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(arquivo)) {
    throw new Error(".env.local nao encontrado.");
  }

  const linhas = fs.readFileSync(arquivo, "utf8").split(/\r?\n/);

  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.trim();

    if (!linha || linha.startsWith("#")) continue;

    const indice = linha.indexOf("=");
    if (indice < 1) continue;

    const chave = linha
      .slice(0, indice)
      .trim()
      .replace(/^\uFEFF/, "");

    let valor = linha.slice(indice + 1).trim();

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

function numeroPtBr(texto) {
  const valor = String(texto || "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
}

function extrairDesconto(titulo) {
  const texto = String(titulo || "");

  const percentual =
    texto.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:OFF|de desconto)?/i);

  if (percentual) {
    return {
      tipo: "percentual",
      valor: numeroPtBr(percentual[1]),
    };
  }

  const fixo =
    texto.match(
      /R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:OFF|de desconto)/i
    );

  if (fixo) {
    return {
      tipo: "valor_fixo",
      valor: numeroPtBr(fixo[1]),
    };
  }

  return {
    tipo: "outro",
    valor: null,
  };
}

function identificarDestino(url) {
  const texto = String(url || "").toLowerCase();

  if (texto.includes("/produto/")) {
    return "produto";
  }

  if (texto.includes("/promocao/")) {
    return "promocao";
  }

  return "categoria_ou_pagina";
}

async function main() {
  carregarEnvLocal();

  const token = process.env.AWIN_API_TOKEN;
  const publisherId =
    Number(process.env.AWIN_PUBLISHER_ID || 2922231);

  if (!token) {
    throw new Error("AWIN_API_TOKEN nao configurado.");
  }

  const resposta = await fetch(
    `https://api.awin.com/publisher/${publisherId}/promotions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: {
          advertiserIds: [17729],
          membership: "joined",
          regionCodes: ["BR"],
          status: "active",
          type: "voucher",
        },
        pagination: {
          page: 1,
          pageSize: 200,
        },
      }),
    }
  );

  if (!resposta.ok) {
    const texto = await resposta.text();

    throw new Error(
      `Awin respondeu HTTP ${resposta.status}: ${texto}`
    );
  }

  const retorno = await resposta.json();
  const agora = Date.now();

  const cupons = (retorno.data || [])
    .filter((item) => {
      if (item?.type !== "voucher") return false;
      if (Number(item?.advertiser?.id) !== 17729) return false;
      if (!item?.advertiser?.joined) return false;
      if (!item?.voucher?.code) return false;

      const inicio = Date.parse(item.startDate || "");
      const fim = Date.parse(item.endDate || "");

      if (Number.isFinite(inicio) && inicio > agora) {
        return false;
      }

      if (Number.isFinite(fim) && fim <= agora) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const desconto = extrairDesconto(item.title);

      return {
        origem: "awin_kabum",

        loja: "Kabum",
        advertiserId: Number(item.advertiser.id),
        promotionId: Number(item.promotionId),

        codigo: item.voucher.code,

        titulo: item.title || "",
        descricao: item.description || "",
        termos: item.terms || "",

        tipoDesconto: desconto.tipo,
        valorDesconto: desconto.valor,

        inicio: item.startDate || null,
        validade: item.endDate || null,
        statusAwin: item.status || "",

        linkDestino: item.url || "",
        linkAfiliado: item.urlTracking || "",

        destinoTipo: identificarDestino(item.url),

        exclusivo:
          Boolean(item.voucher.exclusive),

        atribuicaoPorVoucher:
          Boolean(item.voucher.attributable),

        adicionadoEm:
          item.dateAdded || null,
      };
    })
    .sort((a, b) => {
      return (
        Date.parse(a.validade || "") -
        Date.parse(b.validade || "")
      );
    });

  fs.mkdirSync(
    path.join(process.cwd(), "tmp"),
    { recursive: true }
  );

  const arquivoSaida = path.join(
    process.cwd(),
    "tmp",
    "cupons-kabum-awin.json"
  );

  fs.writeFileSync(
    arquivoSaida,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        totalApi: retorno?.pagination?.total ?? null,
        totalValidos: cupons.length,
        cupons,
      },
      null,
      2
    ),
    "utf8"
  );

  const produtos =
    cupons.filter(
      (item) => item.destinoTipo === "produto"
    ).length;

  const promocoes =
    cupons.filter(
      (item) => item.destinoTipo === "promocao"
    ).length;

  const outros =
    cupons.length - produtos - promocoes;

  console.log("");
  console.log("=== KABUM / AWIN ===");
  console.log(`Total API: ${retorno?.pagination?.total ?? "?"}`);
  console.log(`Validos agora: ${cupons.length}`);
  console.log(`Direto em produto: ${produtos}`);
  console.log(`Paginas de promocao: ${promocoes}`);
  console.log(`Categoria/outra pagina: ${outros}`);
  console.log("");

  console.log("=== CUPONS ===");

  for (const cupom of cupons) {
    console.log(
      `${cupom.codigo} | ${cupom.tipoDesconto} ${cupom.valorDesconto ?? ""} | ${cupom.destinoTipo} | ${cupom.validade}`
    );
  }

  console.log("");
  console.log(`JSON salvo em: ${arquivoSaida}`);
}

main().catch((erro) => {
  console.error("");
  console.error("ERRO KABUM/AWIN:");
  console.error(
    erro instanceof Error ? erro.message : erro
  );
  process.exitCode = 1;
});
