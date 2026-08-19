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

const MAX_PUBLICAR = Math.min(60, Number(process.env.KABUM_PROMOCOES_MAX_PUBLICAR || 40));
const MAX_POR_GRUPO = Math.min(12, Number(process.env.KABUM_PROMOCOES_MAX_POR_GRUPO || 6));
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

  if (/notebook|macbook/.test(t)) return "notebook";
  if (/pc gamer|computador gamer|computador\b|desktop/.test(t)) return "computador";
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

  if (preco === null || preco <= 0) return true;

  if (g === "memoria" && /ddr4/.test(t) && preco > 1500 && n(item.descontoReal) === null) {
    return true;
  }

  if (g === "ssd" && /256gb|240gb/.test(t) && preco > 1000 && n(item.descontoReal) === null) {
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
    "placa-video", "monitor", "processador", "placa-mae", "ssd", "memoria",
    "notebook", "computador", "teclado", "mouse", "console", "apple",
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

  if (preco >= 300) score += 8;

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

  if (item.imagem) score += 5;

  const adicionado = Date.parse(item.adicionadoEm || "");
  if (Number.isFinite(adicionado)) {
    const horas = (Date.now() - adicionado) / 3600000;
    if (horas <= 6) {
      score += 18;
      motivos.push("muito recente");
    } else if (horas <= 24) {
      score += 10;
      motivos.push("recente");
    }
  }

  if (desconto === null && !item.ehGpu) score -= 5;

  return { score, motivos };
}

function aindaValida(item) {
  const fim = Date.parse(item.validade || "");
  if (!Number.isFinite(fim)) return true;
  return fim > Date.now() + MARGEM_VALIDADE_MIN * 60 * 1000;
}

function elegivel(item) {
  const preco = n(item.precoAtual);
  const desconto = n(item.descontoReal);
  const avaliacao = n(item.avaliacao);
  const g = grupo(item);

  if (!item.linkAfiliado || !item.imagem) return false;
  if (preco === null || preco <= 0) return false;
  if (!aindaValida(item) || precoSuspeito(item)) return false;

  if (item.ehGpu) return true;

  if (desconto !== null && desconto >= 10 && preco >= 50) return true;

  const gruposPermitidos = new Set([
    "monitor", "processador", "placa-mae", "ssd", "memoria", "notebook",
    "computador", "teclado", "mouse", "console", "apple",
  ]);

  if (gruposPermitidos.has(g) && avaliacao !== null && avaliacao >= 4.7 && preco >= 100) {
    return true;
  }

  return false;
}

function main() {
  if (!fs.existsSync(entradaPath)) throw new Error("Arquivo enriquecido nao encontrado.");

  const entrada = JSON.parse(fs.readFileSync(entradaPath, "utf8"));

  const candidatos = (entrada.promocoes || [])
    .filter(elegivel)
    .map((item) => {
      const ranking = pontuar(item);
      return {
        ...item,
        grupo: grupo(item),
        scorePublicacao: ranking.score,
        motivosPublicacao: ranking.motivos,
      };
    })
    .sort((a, b) => {
      const descontoA = n(a.descontoReal) ?? -1;
      const descontoB = n(b.descontoReal) ?? -1;
      if (descontoA !== descontoB) return descontoB - descontoA;
      return b.scorePublicacao - a.scorePublicacao;
    });

  const selecionadas = [];
  const contagemGrupo = new Map();

  for (const item of candidatos) {
    if (!item.ehGpu) continue;
    if (selecionadas.length >= MAX_PUBLICAR) break;
    selecionadas.push(item);
    contagemGrupo.set(item.grupo, (contagemGrupo.get(item.grupo) || 0) + 1);
  }

  for (const item of candidatos) {
    if (selecionadas.length >= MAX_PUBLICAR) break;
    if (selecionadas.some((x) => x.promotionId === item.promotionId)) continue;

    const quantidade = contagemGrupo.get(item.grupo) || 0;
    if (quantidade >= MAX_POR_GRUPO) continue;

    selecionadas.push(item);
    contagemGrupo.set(item.grupo, quantidade + 1);
  }

  selecionadas.sort((a, b) => {
    const descontoA = n(a.descontoReal) ?? -1;
    const descontoB = n(b.descontoReal) ?? -1;
    if (descontoA !== descontoB) return descontoB - descontoA;
    return b.scorePublicacao - a.scorePublicacao;
  });

  fs.writeFileSync(
    saidaPath,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        resumo: {
          analisadas: entrada.promocoes?.length || 0,
          candidatas: candidatos.length,
          selecionadas: selecionadas.length,
          maxPublicar: MAX_PUBLICAR,
          maxPorGrupo: MAX_POR_GRUPO,
          placasVideo: selecionadas.filter((x) => x.ehGpu).length,
        },
        selecionadas,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n=== SELECAO INTELIGENTE KABUM V2 ===");
  console.log(`Analisadas: ${entrada.promocoes?.length || 0}`);
  console.log(`Candidatas: ${candidatos.length}`);
  console.log(`Selecionadas: ${selecionadas.length}`);
  console.log(`Limite: ${MAX_PUBLICAR} | Por grupo: ${MAX_POR_GRUPO}`);
}

try {
  main();
} catch (erro) {
  console.error("\nERRO SELECAO:");
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
}
