const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  extrairKabum,
} = require("./extractors/kabum.cjs");

const entradaPath = path.join(
  process.cwd(),
  "tmp",
  "promocoes-kabum-awin.json"
);

const saidaPath = path.join(
  process.cwd(),
  "tmp",
  "promocoes-kabum-awin-enriquecidas.json"
);

const CONCORRENCIA = 5;

function numero(valor) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

function calcularDesconto(
  precoAnterior,
  precoAtual
) {
  const antigo = numero(precoAnterior);
  const atual = numero(precoAtual);

  if (
    antigo === null ||
    atual === null ||
    antigo <= 0 ||
    atual <= 0 ||
    antigo <= atual
  ) {
    return null;
  }

  return arredondar(
    ((antigo - atual) / antigo) * 100
  );
}

function classificarGpu(titulo) {
  const texto = String(titulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const excluir =
    /\b(suporte|cabo|extensor|pc gamer|computador|notebook|macbook|gabinete)\b/i;

  if (excluir.test(texto)) {
    return false;
  }

  if (
    /placa\s+de\s+video/.test(texto)
  ) {
    return true;
  }

  if (
    /\b(geforce|radeon)\b.*\b(gtx|rtx|rx|gt)\s*\d+/i.test(
      texto
    )
  ) {
    return true;
  }

  return false;
}

function calcularScore(produto) {
  let score = 0;

  const desconto =
    numero(produto.descontoReal);

  const avaliacao =
    numero(produto.avaliacao);

  if (desconto !== null) {
    score +=
      Math.min(desconto, 60) * 3;
  }

  if (avaliacao !== null) {
    score += avaliacao * 8;
  }

  if (produto.freteGratis) {
    score += 8;
  }

  if (produto.imagem) {
    score += 4;
  }

  if (
    Array.isArray(
      produto.imagensGaleria
    ) &&
    produto.imagensGaleria.length > 1
  ) {
    score += 3;
  }

  if (produto.ehGpu) {
    score += 5;
  }

  return Math.round(score);
}

function pausa(ms) {
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

async function main() {
  if (!fs.existsSync(entradaPath)) {
    throw new Error(
      "promocoes-kabum-awin.json nao encontrado."
    );
  }

  const entrada = JSON.parse(
    fs.readFileSync(
      entradaPath,
      "utf8"
    )
  );

  const fila =
    (entrada.promocoes || [])
      .filter(
        item =>
          item.destinoTipo ===
            "produto" &&
          item.linkDestino
      );

  console.log("");
  console.log(
    "=== ENRIQUECIMENTO PROMOCOES KABUM ==="
  );

  console.log(
    `Produtos para analisar: ${fila.length}`
  );

  console.log(
    `Concorrencia: ${CONCORRENCIA}`
  );

  console.log("");

  const browser =
    await chromium.launch({
      headless: true,
    });

  const context =
    await browser.newContext({
      locale: "pt-BR",
    });

  const resultados = [];
  const erros = [];

  let proximo = 0;
  let concluidos = 0;

  async function worker(numeroWorker) {
    const page =
      await context.newPage();

    try {
      while (true) {
        const indice = proximo++;

        if (indice >= fila.length) {
          break;
        }

        const promocao =
          fila[indice];

        try {
          const dados =
            await extrairKabum(
              page,
              promocao.linkDestino
            );

          const precoAtual =
            numero(
              dados.precoAtual
            );

          const precoAnterior =
            numero(
              dados.precoAnterior ??
              dados.precoAntigo
            );

          const descontoReal =
            calcularDesconto(
              precoAnterior,
              precoAtual
            );

          const produto = {
            ...promocao,

            nome:
              dados.nome ||
              promocao.titulo ||
              "",

            categoria:
              dados.categoria || "",

            precoAnterior,
            precoAtual,
            descontoReal,

            temDescontoReal:
              descontoReal !== null &&
              descontoReal >= 1,

            parcelas:
              dados.parcelas ||
              dados.parcelamento ||
              "",

            freteGratis:
              Boolean(
                dados.freteGratis
              ),

            imagem:
              dados.imagem || "",

            imagensGaleria:
              dados.imagensGaleria ||
              dados.galeria ||
              [],

            avaliacao:
              numero(
                dados.avaliacao
              ),

            vendas:
              dados.vendas || "",

            descricaoProduto:
              dados.descricao || "",

            urlProduto:
              dados.urlFinal ||
              promocao.linkDestino,

            ehGpu:
              classificarGpu(
                dados.nome ||
                promocao.titulo
              ),
          };

          produto.score =
            calcularScore(produto);

          resultados.push(produto);
        } catch (erro) {
          erros.push({
            promotionId:
              promocao.promotionId,

            titulo:
              promocao.titulo,

            url:
              promocao.linkDestino,

            erro:
              erro instanceof Error
                ? erro.message
                : String(erro),
          });
        }

        concluidos += 1;

        console.log(
          `[${concluidos}/${fila.length}] worker ${numeroWorker} | ${promocao.promotionId} | ${promocao.titulo.slice(0, 70)}`
        );

        await pausa(200);
      }
    } finally {
      await page
        .close()
        .catch(() => undefined);
    }
  }

  try {
    await Promise.all(
      Array.from(
        {
          length:
            Math.min(
              CONCORRENCIA,
              fila.length
            ),
        },
        (_, i) =>
          worker(i + 1)
      )
    );
  } finally {
    await browser.close();
  }

  resultados.sort(
    (a, b) =>
      b.score - a.score
  );

  const comPreco =
    resultados.filter(
      item =>
        numero(item.precoAtual) !==
        null
    );

  const comDesconto =
    resultados.filter(
      item =>
        item.temDescontoReal
    );

  const comImagem =
    resultados.filter(
      item =>
        Boolean(item.imagem)
    );

  const gpus =
    resultados.filter(
      item => item.ehGpu
    );

  const fortes =
    resultados.filter(
      item =>
        item.temDescontoReal &&
        item.descontoReal >= 10 &&
        item.imagem &&
        item.precoAtual > 0
    );

  fs.writeFileSync(
    saidaPath,
    JSON.stringify(
      {
        geradoEm:
          new Date().toISOString(),

        resumo: {
          recebidas:
            fila.length,

          enriquecidas:
            resultados.length,

          erros:
            erros.length,

          comPreco:
            comPreco.length,

          comImagem:
            comImagem.length,

          comDescontoReal:
            comDesconto.length,

          desconto10Mais:
            fortes.length,

          placasVideo:
            gpus.length,
        },

        promocoes:
          resultados,

        erros,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "=== ENRIQUECIMENTO CONCLUIDO ==="
  );

  console.log(
    `Recebidas: ${fila.length}`
  );

  console.log(
    `Enriquecidas: ${resultados.length}`
  );

  console.log(
    `Erros: ${erros.length}`
  );

  console.log(
    `Com preco: ${comPreco.length}`
  );

  console.log(
    `Com imagem: ${comImagem.length}`
  );

  console.log(
    `Com desconto real: ${comDesconto.length}`
  );

  console.log(
    `Desconto >= 10%: ${fortes.length}`
  );

  console.log(
    `Placas de video reais: ${gpus.length}`
  );

  console.log("");
  console.log(
    "=== TOP 20 PROMOCOES ==="
  );

  for (
    const item of
    resultados.slice(0, 20)
  ) {
    console.log(
      `${item.score} pts | ${item.descontoReal ?? "-"}% | R$ ${item.precoAtual ?? "-"} | ${item.nome}`
    );
  }

  console.log("");
  console.log(
    "=== PLACAS DE VIDEO REAIS ==="
  );

  if (!gpus.length) {
    console.log(
      "Nenhuma placa identificada."
    );
  } else {
    for (const item of gpus) {
      console.log(
        `${item.descontoReal ?? "-"}% | R$ ${item.precoAtual ?? "-"} | ${item.nome}`
      );
    }
  }

  console.log("");
  console.log(
    `JSON salvo em: ${saidaPath}`
  );
}

main().catch((erro) => {
  console.error("");
  console.error(
    "ERRO ENRIQUECIMENTO:"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exitCode = 1;
});
