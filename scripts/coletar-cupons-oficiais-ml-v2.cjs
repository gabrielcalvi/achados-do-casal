const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const VALORES_PERMITIDOS = new Set([
  10,
  20,
  30,
  40,
  50,
]);

function numeroOuNull(valor) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function expirado(data) {
  if (!data) return false;

  const timestamp = Date.parse(data);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp <= Date.now();
}

(async () => {

  const perfil = path.join(
    process.cwd(),
    "tmp",
    "meli-buyer-profile"
  );

  const saida = path.join(
    process.cwd(),
    "tmp",
    "ml-cupons-v2-oficiais.json"
  );

  if (!fs.existsSync(perfil)) {
    throw new Error(
      "Perfil comprador nao encontrado em tmp/meli-buyer-profile."
    );
  }

  const context =
    await chromium.launchPersistentContext(
      perfil,
      {
        headless: false,
        viewport: {
          width: 1400,
          height: 900,
        },
      }
    );

  const page =
    context.pages()[0] ||
    await context.newPage();

  console.log("");
  console.log("================================");
  console.log(" ML V2 - CUPONS OFICIAIS");
  console.log("================================");
  console.log("");

  await page.goto(
    "https://www.mercadolivre.com.br/cupons/filter?all=true&source_page=int_view_all",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );

  await page.waitForTimeout(3000);

  if (
    !page.url().includes(
      "mercadolivre.com.br/cupons"
    )
  ) {
    throw new Error(
      `Sessao comprador invalida. URL: ${page.url()}`
    );
  }

  const encontrados = new Map();

  let paginasLidas = 0;
  let totalPaginas = 1;

  while (true) {

    const dados = await page.evaluate(() => {

      const props =
        window._n?.ctx?.r?.appProps?.pageProps;

      const filtro =
        props?.filteredCouponsData;

      if (!filtro) {
        return null;
      }

      return {
        pagina:
          Number(
            filtro.pagination?.page || 1
          ),

        total:
          Number(
            filtro.pagination?.total || 1
          ),

        cupons:
          Array.isArray(filtro.coupons)
            ? filtro.coupons
            : [],

        raw:
          Array.isArray(
            filtro.tracking
              ?.view
              ?.eventData
              ?.coupons_list
          )
            ? filtro.tracking
                .view
                .eventData
                .coupons_list
            : [],
      };
    });

    if (!dados) {
      throw new Error(
        "filteredCouponsData nao encontrado."
      );
    }

    const paginaAtual =
      dados.pagina;

    totalPaginas =
      dados.total;

    paginasLidas += 1;

    console.log(
      `Pagina ${paginaAtual}/${totalPaginas}`
    );

    const visualPorCampanha =
      new Map(
        dados.cupons.map((cupom) => [
          String(cupom.campaignId || ""),
          cupom,
        ])
      );

    for (const raw of dados.raw) {

      const valor =
        numeroOuNull(
          raw.discount_value
        );

      if (
        raw.created_by !== "meli" ||
        raw.discount_type !== "FIXED" ||
        !VALORES_PERMITIDOS.has(valor)
      ) {
        continue;
      }

      if (
        expirado(
          raw.expiration_date
        )
      ) {
        continue;
      }

      const campanhaId =
        String(
          raw.campaign_id || ""
        );

      if (!campanhaId) {
        continue;
      }

      const visual =
        visualPorCampanha.get(
          campanhaId
        ) || {};

      const produtos =
        Array.isArray(visual.items)
          ? visual.items
              .slice(0, 8)
              .map((item) => ({
                nome:
                  item.altText ||
                  item.title ||
                  null,

                imagem:
                  item.imageUrl ||
                  item.image ||
                  null,
              }))
          : [];

      const itemIds =
        Array.isArray(raw.item_ids)
          ? raw.item_ids
              .map(String)
              .slice(0, 30)
          : [];

      encontrados.set(
        campanhaId,
        {
          origem:
            "mercado_livre_oficial",

          campanha_id:
            campanhaId,

          titulo:
            raw.title ||
            visual.title?.text ||
            null,

          tipo_desconto:
            "valor_fixo",

          valor_desconto:
            valor,

          compra_minima:
            numeroOuNull(
              raw.min_amount
            ),

          limite_desconto:
            numeroOuNull(
              raw.cap_amount
            ),

          desconto_real:
            numeroOuNull(
              raw.given_discount
            ),

          validade:
            raw.expiration_date ||
            null,

          status_conta:
            raw.status_id ||
            null,

          criado_por:
            raw.created_by,

          tipo_original:
            raw.discount_type,

          subtitulo:
            visual.initialSubtitle
              ?.text ||
            null,

          acao:
            visual.action?.text ||
            null,

          tipo_acao:
            visual.action?.type ||
            null,

          icone:
            visual.icon ||
            null,

          possui_token_ativacao:
            Boolean(
              raw.code ||
              visual.code
            ),

          item_ids:
            itemIds,

          produtos,

          elegivel_publicacao:
            false,

          motivo_bloqueio:
            "aguardando_validacao_comprador",

          coletado_em:
            new Date()
              .toISOString(),
        }
      );
    }

    if (
      paginaAtual >=
      totalPaginas
    ) {
      break;
    }

    const proximo =
      page
        .locator("a,button")
        .filter({
          hasText: /^Próximo$/,
        })
        .last();

    if (
      await proximo.count() === 0
    ) {
      throw new Error(
        `Botao Proximo nao encontrado na pagina ${paginaAtual}.`
      );
    }

    const href =
      await proximo
        .getAttribute("href");

    if (href) {

      const destino =
        new URL(
          href,
          page.url()
        ).href;

      await page.goto(
        destino,
        {
          waitUntil:
            "domcontentloaded",

          timeout:
            60000,
        }
      );

    } else {

      await proximo.click();

      await page.waitForFunction(
        (paginaAnterior) => {
          return Number(
            window._n
              ?.ctx
              ?.r
              ?.appProps
              ?.pageProps
              ?.filteredCouponsData
              ?.pagination
              ?.page || 0
          ) > paginaAnterior;
        },
        paginaAtual,
        {
          timeout: 30000,
        }
      );
    }

    await page.waitForTimeout(
      250
    );
  }

  const cupons =
    [...encontrados.values()]
      .sort((a, b) => {

        if (
          a.valor_desconto !==
          b.valor_desconto
        ) {
          return (
            a.valor_desconto -
            b.valor_desconto
          );
        }

        return (
          Number(
            a.compra_minima || 0
          ) -
          Number(
            b.compra_minima || 0
          )
        );
      });

  const porValor = {};

  for (
    const valor
    of VALORES_PERMITIDOS
  ) {
    porValor[`R$${valor}`] =
      cupons.filter(
        (cupom) =>
          cupom.valor_desconto ===
          valor
      ).length;
  }

  const resultado = {
    versao:
      "ml-v2",

    fonte:
      "central_comprador",

    criado_por_aceito:
      "meli",

    tipo_aceito:
      "FIXED",

    valores_aceitos:
      [...VALORES_PERMITIDOS],

    total_paginas_lidas:
      paginasLidas,

    total_encontrados:
      cupons.length,

    por_valor:
      porValor,

    publicacao_automatica:
      false,

    cupons,
  };

  fs.writeFileSync(
    saida,
    JSON.stringify(
      resultado,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    " RESULTADO ML V2"
  );

  console.log(
    "================================"
  );

  console.log(
    "Paginas:",
    paginasLidas
  );

  console.log(
    "Cupons oficiais:",
    cupons.length
  );

  console.log(
    "Por valor:",
    porValor
  );

  console.log("");
  console.log(
    "Nenhum cupom publicado."
  );

  console.log(
    "Nenhum cupom ativado."
  );

  console.log(
    "Nenhum token salvo no JSON."
  );

  console.log("");
  console.log(
    "Arquivo:",
    saida
  );

  await context.close();

})().catch((erro) => {

  console.error(
    "ERRO:",
    erro.message
  );

  process.exitCode = 1;
});