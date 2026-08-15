const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const MAX_PAGINAS = Math.max(
  1,
  Math.min(40, Number(process.env.ML_V2_MAX_PAGES || 25) || 25)
);

function numeroOuNull(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function expirado(data) {
  if (!data) return false;
  const timestamp = Date.parse(data);
  return Number.isFinite(timestamp) ? timestamp <= Date.now() : false;
}

function valorPreenchido(valor) {
  if (valor === null || valor === undefined) return false;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === "object") return Object.keys(valor).length > 0;
  if (typeof valor === "string") return valor.trim().length > 0;
  return Boolean(valor);
}

function temRestricaoEstruturada(raw) {
  const campos = [
    "item_id",
    "item_ids",
    "excluded_item_ids",
    "seller_id",
    "seller_ids",
    "excluded_seller_ids",
    "category_id",
    "category_ids",
    "excluded_category_ids",
    "brand_id",
    "brand_ids",
    "excluded_brand_ids",
    "product_id",
    "product_ids",
    "user_product_id",
    "user_product_ids",
    "domain_id",
    "domain_ids",
    "official_store_id",
    "official_store_ids",
  ];

  return campos.some((campo) => valorPreenchido(raw?.[campo]));
}

function textoIndicaRestricao(raw, visual) {
  const texto = [
    raw?.title,
    raw?.subtitle,
    raw?.description,
    visual?.title?.text,
    visual?.initialSubtitle?.text,
    visual?.secondarySubtitle?.text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!texto) return false;

  return [
    /selecionad/,
    /itens? participantes?/,
    /produtos? participantes?/,
    /categorias? selecionad/,
    /categorias? espec/i,
    /marcas? selecionad/,
    /vendedores? selecionad/,
    /lojas? oficiais?/,
    /somente em /,
    /apenas em /,
  ].some((padrao) => padrao.test(texto));
}

function cupomValeNoSiteInteiro(raw, visual) {
  return !temRestricaoEstruturada(raw) && !textoIndicaRestricao(raw, visual);
}

(async () => {
  const authFile =
    process.env.MELI_BUYER_AUTH_STATE_PATH?.trim() ||
    path.join(process.cwd(), "tmp", "meli-buyer-auth.json");

  const saida = path.join(
    process.cwd(),
    "tmp",
    "ml-cupons-v2-oficiais.json"
  );

  if (!fs.existsSync(authFile)) {
    throw new Error(`Sessao comprador nao encontrada: ${authFile}`);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(
      "https://www.mercadolivre.com.br/cupons/filter?all=true&source_page=int_view_all",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    await page.waitForTimeout(2500);

    if (!page.url().includes("mercadolivre.com.br/cupons")) {
      throw new Error(`Sessao comprador invalida. URL: ${page.url()}`);
    }

    const encontrados = new Map();
    let paginasLidas = 0;
    let paginaInicial = null;
    let paginaFinal = null;
    let totalPaginas = 1;
    let concluiuVarredura = false;

    while (paginasLidas < MAX_PAGINAS) {
      const dados = await page.evaluate(() => {
        const filtro = window._n?.ctx?.r?.appProps?.pageProps?.filteredCouponsData;
        if (!filtro) return null;

        return {
          pagina: Number(filtro.pagination?.page || 1),
          total: Number(filtro.pagination?.total || 1),
          cupons: Array.isArray(filtro.coupons) ? filtro.coupons : [],
          raw: Array.isArray(filtro.tracking?.view?.eventData?.coupons_list)
            ? filtro.tracking.view.eventData.coupons_list
            : [],
        };
      });

      if (!dados) {
        throw new Error("filteredCouponsData nao encontrado.");
      }

      const paginaAtual = dados.pagina;
      totalPaginas = dados.total;
      paginaInicial ??= paginaAtual;
      paginaFinal = paginaAtual;
      paginasLidas += 1;

      console.log(
        `[ML V2 lote] Pagina ${paginaAtual}/${totalPaginas} | lote ${paginasLidas}/${MAX_PAGINAS}`
      );

      const visualPorCampanha = new Map(
        dados.cupons.map((cupom) => [String(cupom.campaignId || ""), cupom])
      );

      for (const raw of dados.raw) {
        const valor = numeroOuNull(raw.discount_value);

        if (
          raw.created_by !== "meli" ||
          raw.discount_type !== "FIXED" ||
          !Number.isFinite(valor) ||
          valor <= 0 ||
          expirado(raw.expiration_date)
        ) {
          continue;
        }

        const campanhaId = String(raw.campaign_id || "");
        if (!campanhaId) continue;

        const visual = visualPorCampanha.get(campanhaId) || {};
        if (!cupomValeNoSiteInteiro(raw, visual)) continue;

        const produtos = Array.isArray(visual.items)
          ? visual.items.slice(0, 8).map((item) => ({
              nome: item.altText || item.title || null,
              imagem: item.imageUrl || item.image || null,
            }))
          : [];

        encontrados.set(campanhaId, {
          origem: "mercado_livre_oficial",
          campanha_id: campanhaId,
          titulo: raw.title || visual.title?.text || null,
          tipo_desconto: "valor_fixo",
          valor_desconto: valor,
          compra_minima: numeroOuNull(raw.min_amount),
          limite_desconto: numeroOuNull(raw.cap_amount),
          desconto_real: numeroOuNull(raw.given_discount),
          validade: raw.expiration_date || null,
          status_conta: raw.status_id || null,
          criado_por: raw.created_by,
          tipo_original: raw.discount_type,
          escopo: "site_inteiro",
          sem_restricao_item_vendedor_categoria: true,
          subtitulo: visual.initialSubtitle?.text || null,
          acao: visual.action?.text || null,
          tipo_acao: visual.action?.type || null,
          icone: visual.icon || null,
          possui_token_ativacao: Boolean(raw.code || visual.code),
          item_ids: [],
          produtos,
          elegivel_publicacao: false,
          motivo_bloqueio: "aguardando_validacao_comprador",
          coletado_em: new Date().toISOString(),
        });
      }

      if (paginaAtual >= totalPaginas) {
        concluiuVarredura = true;
        break;
      }

      if (paginasLidas >= MAX_PAGINAS) {
        break;
      }

      const proximo = page
        .locator("a,button")
        .filter({ hasText: /^Próximo$/ })
        .last();

      if ((await proximo.count()) === 0) {
        throw new Error(`Botao Proximo nao encontrado na pagina ${paginaAtual}.`);
      }

      const href = await proximo.getAttribute("href");

      if (href) {
        const destino = new URL(href, page.url()).href;
        await page.goto(destino, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } else {
        await proximo.click();
        await page.waitForFunction(
          (anterior) =>
            Number(
              window._n?.ctx?.r?.appProps?.pageProps?.filteredCouponsData?.pagination?.page || 0
            ) > anterior,
          paginaAtual,
          { timeout: 30000 }
        );
      }

      await page.waitForTimeout(250);
    }

    const cupons = [...encontrados.values()].sort((a, b) => {
      if (a.valor_desconto !== b.valor_desconto) {
        return a.valor_desconto - b.valor_desconto;
      }
      return Number(a.compra_minima || 0) - Number(b.compra_minima || 0);
    });

    const porValor = {};
    for (const cupom of cupons) {
      const chave = `R$${cupom.valor_desconto}`;
      porValor[chave] = (porValor[chave] || 0) + 1;
    }

    const valoresEncontrados = [
      ...new Set(cupons.map((cupom) => cupom.valor_desconto)),
    ].sort((a, b) => a - b);

    const resultado = {
      versao: "ml-v2-lote",
      fonte: "central_comprador",
      criado_por_aceito: "meli",
      tipo_aceito: "FIXED",
      regra_valor: "qualquer_valor_fixo_positivo",
      regra_escopo:
        "somente_site_inteiro_sem_restricao_de_item_vendedor_categoria_marca_produto",
      filtro_escopo_conservador: true,
      modo_execucao: "lote_seguro",
      max_paginas_lote: MAX_PAGINAS,
      pagina_inicial: paginaInicial,
      pagina_final: paginaFinal,
      total_paginas_disponiveis: totalPaginas,
      total_paginas_lidas: paginasLidas,
      varredura_completa: concluiuVarredura,
      total_encontrados: cupons.length,
      valores_encontrados: valoresEncontrados,
      por_valor: porValor,
      publicacao_automatica: false,
      cupons,
    };

    fs.writeFileSync(saida, JSON.stringify(resultado, null, 2), "utf8");

    console.log(
      `[ML V2 lote] OK paginas=${paginasLidas} encontrados=${cupons.length} completa=${concluiuVarredura}`
    );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
})().catch((erro) => {
  console.error("ERRO:", erro.message);
  process.exitCode = 1;
});
