const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  extrairKabum,
} = require("./extractors/kabum.cjs");

const arquivoEntrada = path.join(
  process.cwd(),
  "tmp",
  "cupons-kabum-awin.json"
);

const arquivoSaida = path.join(
  process.cwd(),
  "tmp",
  "cupons-kabum-awin-enriquecidos.json"
);

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function precoComCupom(
  precoAtual,
  tipoDesconto,
  valorDesconto
) {
  const preco = numero(precoAtual);
  const valor = numero(valorDesconto);

  if (preco === null || valor === null) {
    return null;
  }

  if (tipoDesconto === "percentual") {
    return Math.max(
      0,
      Math.round(
        preco * (1 - valor / 100) * 100
      ) / 100
    );
  }

  if (tipoDesconto === "valor_fixo") {
    return Math.max(
      0,
      Math.round((preco - valor) * 100) / 100
    );
  }

  return null;
}

function scoreProduto(produto) {
  let score = 0;

  const avaliacao = numero(produto.avaliacao);

  if (avaliacao !== null) {
    score += avaliacao * 10;
  }

  if (produto.freteGratis) {
    score += 5;
  }

  if (produto.imagem) {
    score += 2;
  }

  if (
    Array.isArray(produto.imagensGaleria) &&
    produto.imagensGaleria.length > 1
  ) {
    score += 2;
  }

  if (produto.descricao) {
    score += 1;
  }

  return Math.round(score * 100) / 100;
}

async function extrairSilencioso(
  pagina,
  url
) {
  const logOriginal = console.log;

  try {
    console.log = () => {};

    return await extrairKabum(
      pagina,
      url
    );
  } finally {
    console.log = logOriginal;
  }
}

async function buscarLinksProdutos(
  pagina,
  urlPagina,
  limite = 8
) {
  await pagina.goto(urlPagina, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await pagina.waitForTimeout(4000);

  const links = await pagina
    .locator('a[href*="/produto/"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.href)
        .filter(Boolean)
    )
    .catch(() => []);

  const unicos = [];

  for (const link of links) {
    if (
      !link.includes("kabum.com.br/produto/")
    ) {
      continue;
    }

    const limpo =
      link.split("?")[0].split("#")[0];

    if (!unicos.includes(limpo)) {
      unicos.push(limpo);
    }

    if (unicos.length >= limite) {
      break;
    }
  }

  return unicos;
}

function normalizarProduto(
  dados,
  cupom,
  urlOriginal
) {
  const precoAtual =
    numero(dados.precoAtual);

  const precoAnterior =
    numero(
      dados.precoAnterior ??
      dados.precoAntigo
    );

  const precoCupom =
    precoComCupom(
      precoAtual,
      cupom.tipoDesconto,
      cupom.valorDesconto
    );

  const economia =
    precoAtual !== null &&
    precoCupom !== null
      ? Math.round(
          (precoAtual - precoCupom) * 100
        ) / 100
      : null;

  const produto = {
    nome: dados.nome || "",
    categoria: dados.categoria || "",
    loja: "Kabum",

    precoAntigo: precoAnterior,
    precoAtual,
    precoComCupom: precoCupom,
    economiaEstimada: economia,

    parcelas:
      dados.parcelas ||
      dados.parcelamento ||
      "",

    freteGratis:
      Boolean(dados.freteGratis),

    imagem: dados.imagem || "",

    imagensGaleria:
      dados.imagensGaleria ||
      dados.galeria ||
      [],

    avaliacao:
      numero(dados.avaliacao),

    descricao:
      dados.descricao || "",

    urlProduto:
      dados.urlFinal ||
      urlOriginal,

    linkAfiliadoCupom:
      cupom.linkAfiliado,

    codigoCupom:
      cupom.codigo,
  };

  produto.scoreProduto =
    scoreProduto(produto);

  return produto;
}

async function main() {
  if (!fs.existsSync(arquivoEntrada)) {
    throw new Error(
      "Execute primeiro coletar-cupons-kabum-awin.cjs."
    );
  }

  const entrada = JSON.parse(
    fs.readFileSync(
      arquivoEntrada,
      "utf8"
    )
  );

  const navegador =
    await chromium.launch({
      headless: true,
    });

  const paginaCatalogo =
    await navegador.newPage({
      locale: "pt-BR",
    });

  const paginaProduto =
    await navegador.newPage({
      locale: "pt-BR",
    });

  const resultados = [];
  const erros = [];

  let diretos = 0;
  let promocoes = 0;
  let revisao = 0;

  try {
    for (let indice = 0;
      indice < entrada.cupons.length;
      indice += 1) {

      const cupom =
        entrada.cupons[indice];

      console.log(
        `[${indice + 1}/${entrada.cupons.length}] ${cupom.codigo} - ${cupom.destinoTipo}`
      );

      let linksProdutos = [];

      if (
        cupom.destinoTipo === "produto"
      ) {
        diretos += 1;

        linksProdutos = [
          cupom.linkDestino,
        ];
      } else if (
        cupom.destinoTipo === "promocao"
      ) {
        promocoes += 1;

        try {
          linksProdutos =
            await buscarLinksProdutos(
              paginaCatalogo,
              cupom.linkDestino,
              6
            );
        } catch (erro) {
          erros.push({
            codigo: cupom.codigo,
            etapa:
              "buscar_produtos_promocao",
            erro:
              erro instanceof Error
                ? erro.message
                : String(erro),
          });
        }
      } else {
        revisao += 1;
      }

      const produtos = [];

      for (
        const linkProduto of
        linksProdutos.slice(0, 4)
      ) {
        try {
          const dados =
            await extrairSilencioso(
              paginaProduto,
              linkProduto
            );

          produtos.push(
            normalizarProduto(
              dados,
              cupom,
              linkProduto
            )
          );
        } catch (erro) {
          erros.push({
            codigo: cupom.codigo,
            produto: linkProduto,
            etapa:
              "extrair_produto",
            erro:
              erro instanceof Error
                ? erro.message
                : String(erro),
          });
        }

        await new Promise(
          (resolve) =>
            setTimeout(resolve, 300)
        );
      }

      produtos.sort(
        (a, b) =>
          b.scoreProduto -
          a.scoreProduto
      );

      const produtoDestaque =
        produtos[0] || null;

      resultados.push({
        ...cupom,

        requerRevisaoElegibilidade:
          cupom.destinoTipo ===
          "categoria_ou_pagina",

        produtosEncontrados:
          produtos.length,

        produtoDestaque,

        produtosCandidatos:
          produtos,
      });
    }
  } finally {
    await navegador.close();
  }

  const comProduto =
    resultados.filter(
      (item) =>
        Boolean(item.produtoDestaque)
    ).length;

  const semProduto =
    resultados.length - comProduto;

  const saida = {
    geradoEm:
      new Date().toISOString(),

    resumo: {
      total:
        resultados.length,

      linksDiretos:
        diretos,

      paginasPromocao:
        promocoes,

      revisaoElegibilidade:
        revisao,

      cuponsComProduto:
        comProduto,

      cuponsSemProduto:
        semProduto,

      erros:
        erros.length,
    },

    cupons:
      resultados,

    erros,
  };

  fs.writeFileSync(
    arquivoSaida,
    JSON.stringify(
      saida,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "=== ENRIQUECIMENTO KABUM CONCLUIDO ==="
  );
  console.log(
    `Cupons processados: ${resultados.length}`
  );
  console.log(
    `Links diretos: ${diretos}`
  );
  console.log(
    `Paginas promocao: ${promocoes}`
  );
  console.log(
    `Revisao elegibilidade: ${revisao}`
  );
  console.log(
    `Cupons com produto: ${comProduto}`
  );
  console.log(
    `Cupons sem produto: ${semProduto}`
  );
  console.log(
    `Erros: ${erros.length}`
  );

  console.log("");
  console.log(
    "=== PRODUTOS DESTAQUE ==="
  );

  for (const item of resultados) {
    if (!item.produtoDestaque) {
      console.log(
        `${item.codigo} | SEM PRODUTO AUTOMATICO`
      );
      continue;
    }

    const p =
      item.produtoDestaque;

    console.log(
      `${item.codigo} | ${p.nome} | R$ ${p.precoAtual} -> R$ ${p.precoComCupom} | nota ${p.avaliacao ?? "-"}`
    );
  }

  console.log("");
  console.log(
    `JSON salvo em: ${arquivoSaida}`
  );
}

main().catch((erro) => {
  console.error("");
  console.error(
    "ERRO NO ENRIQUECIMENTO KABUM:"
  );
  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );
  process.exitCode = 1;
});
