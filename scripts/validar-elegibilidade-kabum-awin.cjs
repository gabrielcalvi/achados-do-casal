const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const entradaPath = path.join(
  process.cwd(),
  "tmp",
  "cupons-kabum-awin-enriquecidos.json"
);

const saidaPath = path.join(
  process.cwd(),
  "tmp",
  "cupons-kabum-awin-validados.json"
);

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (!fs.existsSync(entradaPath)) {
    throw new Error(
      "Arquivo enriquecido nao encontrado."
    );
  }

  const entrada = JSON.parse(
    fs.readFileSync(entradaPath, "utf8")
  );

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    locale: "pt-BR",
  });

  const resultado = [];

  try {
    for (
      let i = 0;
      i < entrada.cupons.length;
      i += 1
    ) {
      const cupom = entrada.cupons[i];

      let validacao = {
        confianca: "baixa",
        elegibilidadeAutomatica: false,
        motivo: "",
        codigoEncontradoNaPagina: false,
        urlFinal: cupom.linkDestino,
      };

      console.log(
        `[${i + 1}/${entrada.cupons.length}] ${cupom.codigo}`
      );

      // Awin apontou diretamente para um produto específico.
      if (cupom.destinoTipo === "produto") {
        validacao = {
          confianca: "alta",
          elegibilidadeAutomatica:
            Boolean(cupom.produtoDestaque),
          motivo:
            "Voucher Awin aponta diretamente para produto.",
          codigoEncontradoNaPagina: null,
          urlFinal: cupom.linkDestino,
        };
      }

      // Promoção: validar o próprio código dentro da página.
      else if (
        cupom.destinoTipo === "promocao"
      ) {
        try {
          await page.goto(cupom.linkDestino, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });

          await page.waitForTimeout(2500);

          const textoPagina =
            normalizar(
              await page.locator("body")
                .innerText()
                .catch(() => "")
            );

          const codigo =
            normalizar(cupom.codigo);

          const codigoEncontrado =
            textoPagina.includes(codigo);

          validacao = {
            confianca:
              codigoEncontrado
                ? "alta"
                : "baixa",

            elegibilidadeAutomatica:
              codigoEncontrado &&
              Boolean(cupom.produtoDestaque),

            motivo:
              codigoEncontrado
                ? "Codigo oficial encontrado na pagina da promocao."
                : "Codigo nao encontrado na pagina atual da promocao.",

            codigoEncontradoNaPagina:
              codigoEncontrado,

            urlFinal: page.url(),
          };
        } catch (erro) {
          validacao = {
            confianca: "baixa",
            elegibilidadeAutomatica: false,
            motivo:
              `Erro ao validar pagina: ${
                erro instanceof Error
                  ? erro.message
                  : String(erro)
              }`,
            codigoEncontradoNaPagina:
              false,
            urlFinal: cupom.linkDestino,
          };
        }
      }

      // Categoria genérica: não presumir elegibilidade.
      else {
        validacao = {
          confianca: "baixa",
          elegibilidadeAutomatica: false,
          motivo:
            "Destino generico/categoria; requer validacao adicional.",
          codigoEncontradoNaPagina: null,
          urlFinal: cupom.linkDestino,
        };
      }

      resultado.push({
        ...cupom,
        validacao,
      });
    }
  } finally {
    await browser.close();
  }

  const automaticos = resultado.filter(
    x => x.validacao.elegibilidadeAutomatica
  );

  const bloqueados = resultado.filter(
    x => !x.validacao.elegibilidadeAutomatica
  );

  fs.writeFileSync(
    saidaPath,
    JSON.stringify(
      {
        geradoEm:
          new Date().toISOString(),

        resumo: {
          total: resultado.length,
          aprovadosAutomaticamente:
            automaticos.length,
          bloqueados:
            bloqueados.length,
        },

        cupons: resultado,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "=== VALIDACAO KABUM CONCLUIDA ==="
  );

  console.log(
    `Total: ${resultado.length}`
  );

  console.log(
    `Aprovados automaticamente: ${automaticos.length}`
  );

  console.log(
    `Bloqueados: ${bloqueados.length}`
  );

  console.log("");
  console.log("=== APROVADOS ===");

  for (const item of automaticos) {
    console.log(
      `${item.codigo} | ${item.destinoTipo} | ${item.produtoDestaque?.nome || ""}`
    );
  }

  console.log("");
  console.log("=== BLOQUEADOS ===");

  for (const item of bloqueados) {
    console.log(
      `${item.codigo} | ${item.destinoTipo} | ${item.validacao.motivo}`
    );
  }

  console.log("");
  console.log(
    `JSON salvo em: ${saidaPath}`
  );
}

main().catch((erro) => {
  console.error("");
  console.error("ERRO:");
  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );
  process.exitCode = 1;
});
