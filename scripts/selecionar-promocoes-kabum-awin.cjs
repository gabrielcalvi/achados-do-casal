const fs = require("fs");
const path = require("path");

const entradaPath = path.join(
  process.cwd(),
  "tmp",
  "promocoes-kabum-awin-enriquecidas.json"
);

const saidaPath = path.join(
  process.cwd(),
  "tmp",
  "promocoes-kabum-awin-selecionadas.json"
);

const MAX_PUBLICAR = 10;
const MAX_POR_GRUPO = 2;
const MARGEM_VALIDADE_MIN = 60;

function n(valor) {
  const x = Number(valor);
  return Number.isFinite(x) ? x : null;
}

function texto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function grupo(item) {
  const t = texto(item.nome);

  if (item.ehGpu) return "placa-video";

  // Ordem importa: PC/notebook podem conter "SSD".
  if (/notebook|macbook/.test(t)) {
    return "notebook";
  }

  if (
    /pc gamer|computador gamer|computador\b|desktop/.test(t)
  ) {
    return "computador";
  }

  if (/monitor/.test(t)) return "monitor";
  if (/processador/.test(t)) return "processador";
  if (/placa-mae/.test(t)) return "placa-mae";
  if (/memoria/.test(t)) return "memoria";
  if (/ssd|nvme/.test(t)) return "ssd";
  if (/cadeira gamer/.test(t)) return "cadeira";
  if (/teclado/.test(t)) return "teclado";
  if (/mouse gamer/.test(t)) return "mouse";
  if (/water cooler|air cooler/.test(t)) return "cooler";
  if (/fonte/.test(t)) return "fonte";
  if (/xbox|playstation|console|vr2/.test(t)) return "console";
  if (/ipad|apple watch/.test(t)) return "apple";

  return "outros";
}

function precoSuspeito(item) {
  const preco = n(item.precoAtual);
  const t = texto(item.nome);
  const g = grupo(item);

  if (preco === null || preco <= 0) {
    return true;
  }

  // Proteções simples contra preços claramente estranhos
  // quando não temos preço anterior para comparar.
  if (
    g === "memoria" &&
    /ddr4/.test(t) &&
    preco > 1500 &&
    n(item.descontoReal) === null
  ) {
    return true;
  }

  if (
    g === "ssd" &&
    /256gb|240gb/.test(t) &&
    preco > 1000 &&
    n(item.descontoReal) === null
  ) {
    return true;
  }

  return false;
}

function pontuar(item) {
  let score = 0;
  const motivos = [];

  const preco = n(item.precoAtual) || 0;
  const desconto = n(item.descontoReal);
  const avaliacao = n(item.avaliacao);
  const g = grupo(item);

  if (item.ehGpu) {
    score += 120;
    motivos.push("placa de video");
  }

  const gruposFortes = new Set([
    "placa-video",
    "monitor",
    "processador",
    "placa-mae",
    "ssd",
    "memoria",
    "notebook",
    "computador",
    "teclado",
    "mouse",
    "console",
    "apple",
  ]);

  if (gruposFortes.has(g)) {
    score += 35;
    motivos.push("categoria forte");
  }

  if (desconto !== null) {
    if (desconto >= 25) {
      score += 60;
      motivos.push(`desconto ${desconto}%`);
    } else if (desconto >= 15) {
      score += 48;
      motivos.push(`desconto ${desconto}%`);
    } else if (desconto >= 10) {
      score += 38;
      motivos.push(`desconto ${desconto}%`);
    } else if (desconto >= 5) {
      score += 20;
      motivos.push(`desconto ${desconto}%`);
    }
  }

  // Preço alto não significa oferta melhor.
  // Dá só um pequeno peso para produtos relevantes.
  if (preco >= 300) {
    score += 8;
  }

  if (avaliacao !== null) {
    if (avaliacao >= 4.8) {
      score += 25;
      motivos.push("avaliacao alta");
    } else if (avaliacao >= 4.5) {
      score += 15;
      motivos.push("boa avaliacao");
    }
  }

  if (item.freteGratis) {
    score += 8;
    motivos.push("frete gratis");
  }

  if (item.imagem) {
    score += 5;
  }

  const adicionado =
    Date.parse(item.adicionadoEm || "");

  if (Number.isFinite(adicionado)) {
    const horas =
      (Date.now() - adicionado) / 3600000;

    if (horas <= 6) {
      score += 18;
      motivos.push("muito recente");
    } else if (horas <= 24) {
      score += 10;
      motivos.push("recente");
    }
  }

  // Promoção sem preço anterior:
  // pode entrar, pois é promoção oficial Awin,
  // mas não ganha pontos de desconto.
  if (
    desconto === null &&
    !item.ehGpu
  ) {
    score -= 5;
  }

  return {
    score,
    motivos,
  };
}

function aindaValida(item) {
  const fim = Date.parse(item.validade || "");

  if (!Number.isFinite(fim)) {
    return true;
  }

  return (
    fim >
    Date.now() +
      MARGEM_VALIDADE_MIN *
        60 *
        1000
  );
}

function elegivel(item) {
  const preco = n(item.precoAtual);
  const desconto = n(item.descontoReal);
  const avaliacao = n(item.avaliacao);
  const g = grupo(item);

  if (!item.linkAfiliado) return false;
  if (!item.imagem) return false;

  if (
    preco === null ||
    preco <= 0
  ) {
    return false;
  }

  if (!aindaValida(item)) {
    return false;
  }

  if (precoSuspeito(item)) {
    return false;
  }

  // Placas reais entram porque são promoção oficial
  // direta de produto na Awin.
  if (item.ehGpu) {
    return true;
  }

  // Desconto comprovado.
  if (
    desconto !== null &&
    desconto >= 10 &&
    preco >= 50
  ) {
    return true;
  }

  // Sem preço anterior, exige categoria relevante
  // e avaliação forte.
  const gruposPermitidos =
    new Set([
      "monitor",
      "processador",
      "placa-mae",
      "ssd",
      "memoria",
      "notebook",
      "computador",
      "teclado",
      "mouse",
      "console",
      "apple",
    ]);

  if (
    gruposPermitidos.has(g) &&
    avaliacao !== null &&
    avaliacao >= 4.7 &&
    preco >= 100
  ) {
    return true;
  }

  return false;
}

function main() {
  if (!fs.existsSync(entradaPath)) {
    throw new Error(
      "Arquivo enriquecido nao encontrado."
    );
  }

  const entrada = JSON.parse(
    fs.readFileSync(
      entradaPath,
      "utf8"
    )
  );

  const candidatos =
    (entrada.promocoes || [])
      .filter(elegivel)
      .map(item => {
        const ranking = pontuar(item);

        return {
          ...item,
          grupo: grupo(item),
          scorePublicacao:
            ranking.score,
          motivosPublicacao:
            ranking.motivos,
        };
      })
      .sort(
        (a, b) =>
          b.scorePublicacao -
          a.scorePublicacao
      );

  const selecionadas = [];
  const contagemGrupo =
    new Map();

  // Garantimos as placas de vídeo reais.
  for (const item of candidatos) {
    if (!item.ehGpu) continue;

    selecionadas.push(item);

    contagemGrupo.set(
      item.grupo,
      (contagemGrupo.get(item.grupo) || 0) + 1
    );
  }

  // Completa com diversidade.
  for (const item of candidatos) {
    if (
      selecionadas.length >=
      MAX_PUBLICAR
    ) {
      break;
    }

    if (
      selecionadas.some(
        x =>
          x.promotionId ===
          item.promotionId
      )
    ) {
      continue;
    }

    const quantidade =
      contagemGrupo.get(item.grupo) || 0;

    if (
      quantidade >= MAX_POR_GRUPO
    ) {
      continue;
    }

    selecionadas.push(item);

    contagemGrupo.set(
      item.grupo,
      quantidade + 1
    );
  }

  fs.writeFileSync(
    saidaPath,
    JSON.stringify(
      {
        geradoEm:
          new Date().toISOString(),

        resumo: {
          analisadas:
            entrada.promocoes?.length || 0,

          candidatas:
            candidatos.length,

          selecionadas:
            selecionadas.length,

          placasVideo:
            selecionadas.filter(
              x => x.ehGpu
            ).length,
        },

        selecionadas,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "=== SELECAO INTELIGENTE KABUM V2 ==="
  );

  console.log(
    `Analisadas: ${
      entrada.promocoes?.length || 0
    }`
  );

  console.log(
    `Candidatas: ${candidatos.length}`
  );

  console.log(
    `Selecionadas: ${selecionadas.length}`
  );

  console.log(
    `Placas de video: ${
      selecionadas.filter(
        x => x.ehGpu
      ).length
    }`
  );

  console.log("");
  console.log(
    "=== PROMOCOES PARA PUBLICAR ==="
  );

  for (const item of selecionadas) {
    console.log("");
    console.log(
      `${item.scorePublicacao} pts | ${item.grupo}`
    );

    console.log(item.nome);

    console.log(
      `Preco: R$ ${item.precoAtual}`
    );

    console.log(
      `Preco anterior: ${
        item.precoAnterior ??
        "nao identificado"
      }`
    );

    console.log(
      `Desconto real: ${
        item.descontoReal !== null &&
        item.descontoReal !== undefined
          ? item.descontoReal + "%"
          : "nao identificado"
      }`
    );

    console.log(
      `Avaliacao: ${
        item.avaliacao ??
        "nao identificada"
      }`
    );

    console.log(
      `Motivos: ${
        item.motivosPublicacao.join(", ")
      }`
    );

    console.log(
      `Tracking Awin: ${
        item.linkAfiliado
          ? "OK"
          : "NAO"
      }`
    );
  }

  console.log("");
  console.log(
    `JSON salvo em: ${saidaPath}`
  );
}

try {
  main();
} catch (erro) {
  console.error("");
  console.error(
    "ERRO SELECAO:"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exitCode = 1;
}
