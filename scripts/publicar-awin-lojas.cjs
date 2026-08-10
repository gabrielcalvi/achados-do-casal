const fs = require("fs");
const path = require("path");

function carregarEnv() {
  const arquivo = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(arquivo)) {
    throw new Error(".env.local nao encontrado.");
  }

  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const texto = linha.trim();

    if (!texto || texto.startsWith("#")) {
      continue;
    }

    const p = texto.indexOf("=");

    if (p < 1) {
      continue;
    }

    const chave = texto.slice(0, p).trim();
    let valor = texto.slice(p + 1).trim();

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

carregarEnv();

const { createClient } = require("@supabase/supabase-js");
const lojas = require("./awin-lojas.config.cjs");

const CONFIRMAR =
  process.argv.includes("CONFIRMAR");

const PUBLISHER_ID =
  String(process.env.AWIN_PUBLISHER_ID || "2922231");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Credenciais Supabase nao encontradas.");
}

const supabase = createClient(
  supabaseUrl,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

function texto(valor) {
  return String(valor ?? "").trim();
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function arquivoJson(nome) {
  const arquivo = path.join(
    process.cwd(),
    "tmp",
    nome
  );

  if (!fs.existsSync(arquivo)) {
    return [];
  }

  const json = JSON.parse(
    fs.readFileSync(arquivo, "utf8")
  );

  if (Array.isArray(json)) {
    return json;
  }

  const chaves = [
    "cupons",
    "promocoes",
    "ofertas",
    "itens",
    "items",
    "promotions",
    "data"
  ];

  for (const chave of chaves) {
    if (Array.isArray(json[chave])) {
      return json[chave];
    }
  }

  return [];
}

function idPromocao(item) {
  return texto(
    item.promotionId ??
    item.promotion_id ??
    item.id ??
    item.offerId ??
    item.offer_id
  );
}

function tituloItem(item) {
  return texto(
    item.titulo ??
    item.title ??
    item.name ??
    item.nome ??
    item.description ??
    item.descricao
  );
}

function descricaoItem(item) {
  return texto(
    item.descricao ??
    item.description ??
    item.titulo ??
    item.title ??
    item.name
  );
}

function termosItem(item) {
  return texto(
    item.termos ??
    item.terms ??
    item.regras ??
    item.conditions
  );
}

function inicioItem(item) {
  return (
    item.inicio ??
    item.startDate ??
    item.start_date ??
    item.dateStart ??
    null
  );
}

function validadeItem(item) {
  return (
    item.validade ??
    item.endDate ??
    item.end_date ??
    item.dateEnd ??
    null
  );
}

function linkDestino(item) {
  return texto(
    item.linkDestino ??
    item.urlDestination ??
    item.destinationUrl ??
    item.url ??
    item.link
  );
}

function linkAfiliado(item) {
  return texto(
    item.linkAfiliado ??
    item.urlTracking ??
    item.trackingUrl ??
    item.tracking_url
  );
}

function ativoAgora(item) {
  const validade = Date.parse(
    String(validadeItem(item) || "")
  );

  if (
    Number.isFinite(validade) &&
    validade <= Date.now()
  ) {
    return false;
  }

  const status = texto(
    item.statusAwin ??
    item.status
  ).toLowerCase();

  if (
    status &&
    ["expired", "inactive", "cancelled", "canceled"].includes(status)
  ) {
    return false;
  }

  return true;
}

function trackingOk(item, loja) {
  const link = linkAfiliado(item);

  return (
    link.includes(`awinmid=${loja.advertiserId}`) &&
    link.includes(`awinaffid=${PUBLISHER_ID}`)
  );
}

function desconto(item) {
  let tipo = texto(
    item.tipoDesconto ??
    item.discountType
  ).toLowerCase();

  let valor = numero(
    item.valorDesconto ??
    item.discountValue
  );

  const titulo = tituloItem(item);

  if (!tipo || valor === null) {
    const percentual =
      titulo.match(/(\d+(?:[.,]\d+)?)\s*%/);

    if (percentual) {
      tipo = "percentual";
      valor = Number(
        percentual[1].replace(",", ".")
      );
    }
  }

  return {
    tipo,
    valor
  };
}

function pedidoMinimo(item) {
  const fonte = [
    tituloItem(item),
    descricaoItem(item),
    termosItem(item)
  ].join(" ");

  const padroes = [
    /compras?\s+a\s+partir\s+de\s+R\$\s*([\d.,]+)/i,
    /pedido\s+m[ií]nimo[^R]*R\$\s*([\d.,]+)/i,
    /acima\s+de\s+R\$\s*([\d.,]+)/i
  ];

  for (const padrao of padroes) {
    const match = fonte.match(padrao);

    if (match) {
      const valor = Number(
        match[1]
          .replace(/\./g, "")
          .replace(",", ".")
      );

      if (Number.isFinite(valor)) {
        return valor;
      }
    }
  }

  return null;
}

function regrasGenericas(item, loja, tipo) {
  const termos = termosItem(item);
  const descricao = descricaoItem(item);

  let regras =
    termos.replace(/[\s.\-_/]+/g, "").length >= 3
      ? termos
      : descricao;

  if (!regras) {
    regras =
      tipo === "cupom"
        ? `Cupom oficial disponibilizado pela ${loja.nome} via Awin.`
        : `Promocao oficial disponibilizada pela ${loja.nome} via Awin.`;
  }

  if (!/confira as condi/i.test(regras)) {
    regras +=
      " Confira as condições e a disponibilidade antes de finalizar.";
  }

  return regras.replace(/\s+/g, " ").trim();
}

function especialCea(item, loja) {
  const codigo =
    texto(item.codigo).toUpperCase();

  if (
    loja.slug === "cea" &&
    codigo === "AFILIADOS10"
  ) {
    return {
      titulo:
        "8% OFF na C&A | 10% OFF no app",

      descricao:
        "Use o cupom AFILIADOS10 para obter 8% OFF no site da C&A ou 10% OFF no app, em Apparel, beleza, óculos e relógios, em compras a partir de R$ 199.",

      regras:
        "8% OFF no site e 10% OFF no app em Apparel, beleza, óculos e relógios, em compras a partir de R$ 199. Cupom oficial disponibilizado pela C&A via Awin. Confira as condições antes de finalizar a compra.",

      pedidoMinimo: 199,
      descontoPercentual: 8
    };
  }

  return null;
}

async function lojasBanco() {
  const { data, error } = await supabase
    .from("economize_lojas")
    .select(
      "id,nome,slug,dominio,logo_url,ativa"
    )
    .eq("ativa", true);

  if (error) {
    throw error;
  }

  return data || [];
}

async function obterLoja(config, banco) {
  let encontrada =
    banco.find(
      (loja) =>
        loja.slug === config.dbSlug
    );

  if (!encontrada) {
    encontrada =
      banco.find((loja) => {
        const dominio =
          texto(loja.dominio).toLowerCase();

        return dominio.includes(
          config.dominio.toLowerCase()
        );
      });
  }

  if (encontrada) {
    if (
      CONFIRMAR &&
      config.logoUrl &&
      encontrada.logo_url !== config.logoUrl
    ) {
      const { data, error } = await supabase
        .from("economize_lojas")
        .update({
          logo_url: config.logoUrl
        })
        .eq("id", encontrada.id)
        .select(
          "id,nome,slug,dominio,logo_url,ativa"
        )
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    return encontrada;
  }

  if (!CONFIRMAR) {
    return {
      id: null,
      nome: config.nome,
      slug: config.dbSlug,
      dominio: config.dominio,
      logo_url: config.logoUrl,
      ativa: true,
      seriaCriada: true
    };
  }

  const { data, error } = await supabase
    .from("economize_lojas")
    .insert({
      nome: config.nome,
      slug: config.dbSlug,
      dominio: config.dominio,
      logo_url: config.logoUrl,
      ativa: true
    })
    .select(
      "id,nome,slug,dominio,logo_url,ativa"
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function salvarOferta(dedupe, dados) {
  const { data: existente, error: erroBusca } =
    await supabase
      .from("economize_ofertas")
      .select("id")
      .eq("dedupe_key", dedupe)
      .maybeSingle();

  if (erroBusca) {
    throw erroBusca;
  }

  if (existente) {
    const { data, error } = await supabase
      .from("economize_ofertas")
      .update(dados)
      .eq("id", existente.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      acao: "atualizada"
    };
  }

  const { data, error } = await supabase
    .from("economize_ofertas")
    .insert(dados)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    acao: "criada"
  };
}

async function salvarCupom(
  lojaId,
  codigo,
  dedupe,
  origem,
  dados
) {
  let { data: existente, error } =
    await supabase
      .from("economize_cupons")
      .select("id,origem")
      .eq("dedupe_key", dedupe)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!existente) {
    const buscaCodigo = await supabase
      .from("economize_cupons")
      .select("id,origem")
      .eq("loja_id", lojaId)
      .eq("codigo", codigo)
      .maybeSingle();

    if (buscaCodigo.error) {
      throw buscaCodigo.error;
    }

    existente = buscaCodigo.data;
  }

  if (existente) {
    if (
      existente.origem &&
      existente.origem !== origem
    ) {
      throw new Error(
        `Cupom ${codigo} ja existe com origem diferente: ${existente.origem}`
      );
    }

    const atualizado = await supabase
      .from("economize_cupons")
      .update(dados)
      .eq("id", existente.id)
      .select("id")
      .single();

    if (atualizado.error) {
      throw atualizado.error;
    }

    return {
      id: atualizado.data.id,
      acao: "atualizado"
    };
  }

  const inserido = await supabase
    .from("economize_cupons")
    .insert(dados)
    .select("id")
    .single();

  if (inserido.error) {
    throw inserido.error;
  }

  return {
    id: inserido.data.id,
    acao: "criado"
  };
}

async function vincular(cupomId, ofertaId) {
  const { data, error } = await supabase
    .from("economize_cupons_ofertas")
    .select("cupom_id")
    .eq("cupom_id", cupomId)
    .eq("oferta_id", ofertaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return;
  }

  const insercao = await supabase
    .from("economize_cupons_ofertas")
    .insert({
      cupom_id: cupomId,
      oferta_id: ofertaId
    });

  if (insercao.error) {
    throw insercao.error;
  }
}

async function expirarAusentes(
  tabela,
  lojaId,
  origem,
  dedupesAtivos
) {
  const { data, error } = await supabase
    .from(tabela)
    .select("id,dedupe_key")
    .eq("loja_id", lojaId)
    .eq("origem", origem)
    .eq("status", "ativo");

  if (error) {
    throw error;
  }

  const ids =
    (data || [])
      .filter(
        (item) =>
          !dedupesAtivos.has(
            texto(item.dedupe_key)
          )
      )
      .map((item) => item.id);

  if (!ids.length) {
    return 0;
  }

  const agora = new Date().toISOString();

  const atualizacao = await supabase
    .from(tabela)
    .update({
      validade: agora,
      verificado_em: agora,
      updated_at: agora
    })
    .in("id", ids);

  if (atualizacao.error) {
    throw atualizacao.error;
  }

  return ids.length;
}

async function processarLoja(config, banco) {
  const loja = await obterLoja(
    config,
    banco
  );

  const cupons = arquivoJson(
    `cupons-${config.slug}-awin.json`
  ).filter(ativoAgora);

  const promocoes = arquivoJson(
    `promocoes-${config.slug}-awin.json`
  ).filter(ativoAgora);

  console.log(
    `\n=== ${config.nome.toUpperCase()} ===`
  );

  console.log(
    `Advertiser: ${config.advertiserId}`
  );

  console.log(
    `Loja DB: ${
      loja.seriaCriada
        ? "seria criada"
        : `${loja.slug} | OK`
    }`
  );

  console.log(
    `Logo: ${
      config.logoUrl ||
      loja.logo_url ||
      "nao configurada"
    }`
  );

  console.log(
    `Vouchers ativos: ${cupons.length}`
  );

  console.log(
    `Promocoes ativas: ${promocoes.length}`
  );

  const ativosCupons = new Set();
  const ativosOfertasCupom = new Set();
  const ativosPromocoes = new Set();

  for (const cupom of cupons) {
    const codigo =
      texto(cupom.codigo).toUpperCase();

    const promotionId =
      idPromocao(cupom);

    if (
      !codigo ||
      !promotionId ||
      !trackingOk(cupom, config)
    ) {
      console.log(
        `BLOQUEADO voucher ${codigo || promotionId || "sem id"} | tracking/dados invalidos`
      );
      continue;
    }

    const dedupeCupom =
      `awin:${config.slug}:voucher:${promotionId}`;

    const dedupeOferta =
      `${dedupeCupom}:landing`;

    ativosCupons.add(dedupeCupom);
    ativosOfertasCupom.add(dedupeOferta);

    const desc = desconto(cupom);
    const especial =
      especialCea(cupom, config);

    const titulo =
      especial?.titulo ||
      tituloItem(cupom) ||
      `${codigo} | ${config.nome}`;

    const descricao =
      especial?.descricao ||
      descricaoItem(cupom) ||
      titulo;

    const regras =
      especial?.regras ||
      regrasGenericas(
        cupom,
        config,
        "cupom"
      );

    const minimo =
      especial?.pedidoMinimo ??
      pedidoMinimo(cupom);

    const percentual =
      especial?.descontoPercentual ??
      (
        desc.tipo === "percentual"
          ? desc.valor
          : null
      );

    const valorFixo =
      desc.tipo === "valor_fixo"
        ? desc.valor
        : null;

    console.log(
      `CUPOM -> ${codigo} | ${
        percentual !== null
          ? `${percentual}%`
          : valorFixo !== null
          ? `R$ ${valorFixo}`
          : "beneficio textual"
      } | tracking OK`
    );

    if (!CONFIRMAR) {
      continue;
    }

    const agora =
      new Date().toISOString();

    const imagem =
      config.logoUrl ||
      loja.logo_url ||
      null;

    const bruto = {
      fonte: "awin",
      advertiser_id:
        Number(config.advertiserId),
      publisher_id:
        Number(PUBLISHER_ID),
      promotion_id:
        promotionId,
      awin: cupom
    };

    const origem =
      `agente_cupons_awin_${config.slug}`;

    const oferta = await salvarOferta(
      dedupeOferta,
      {
        loja_id: loja.id,
        tipo: "cupom",
        status: "ativo",
        titulo,
        descricao,
        codigo,
        categoria: null,
        regras,
        imagem_url: imagem,
        link_destino:
          linkDestino(cupom),
        link_afiliado:
          linkAfiliado(cupom),
        desconto_percentual:
          percentual,
        valor_desconto:
          valorFixo,
        cashback_percentual: null,
        pedido_minimo: minimo,
        preco_original: null,
        preco_oferta: null,
        data_inicio:
          inicioItem(cupom),
        validade:
          validadeItem(cupom),
        destaque: false,
        selos:
          ["Cupom oficial Awin"],
        origem,
        origem_url:
          linkDestino(cupom),
        dedupe_key:
          dedupeOferta,
        dados_brutos: bruto,
        coletado_em: agora,
        verificado_em: agora,
        updated_at: agora
      }
    );

    const cupomDb =
      await salvarCupom(
        loja.id,
        codigo,
        dedupeCupom,
        origem,
        {
          loja_id: loja.id,
          status: "ativo",
          codigo,
          titulo,
          descricao,
          regras,
          tipo_desconto:
            desc.tipo || "outro",
          desconto_percentual:
            percentual,
          valor_desconto:
            valorFixo,
          pedido_minimo:
            minimo,
          limite_desconto: null,
          publico_alvo: null,
          elegibilidade: null,
          limite_por_usuario: null,
          somente_app: false,
          exige_mercado_pago: false,
          data_inicio:
            inicioItem(cupom),
          validade:
            validadeItem(cupom),
          link_destino:
            linkDestino(cupom),
          link_afiliado:
            linkAfiliado(cupom),
          origem,
          origem_url:
            linkDestino(cupom),
          dedupe_key:
            dedupeCupom,
          dados_brutos: bruto,
          coletado_em: agora,
          verificado_em: agora,
          updated_at: agora
        }
      );

    await vincular(
      cupomDb.id,
      oferta.id
    );

    console.log(
      `  OK | oferta ${oferta.acao} | cupom ${cupomDb.acao}`
    );
  }

  for (const promocao of promocoes) {
    const promotionId =
      idPromocao(promocao);

    if (
      !promotionId ||
      !trackingOk(promocao, config)
    ) {
      console.log(
        `BLOQUEADA promocao ${promotionId || "sem id"} | tracking/dados invalidos`
      );
      continue;
    }

    const dedupe =
      `awin:${config.slug}:promotion:${promotionId}`;

    ativosPromocoes.add(dedupe);

    const titulo =
      tituloItem(promocao) ||
      `Promocao ${config.nome}`;

    const descricao =
      descricaoItem(promocao) ||
      titulo;

    const regras =
      regrasGenericas(
        promocao,
        config,
        "promocao"
      );

    const desc =
      desconto(promocao);

    const percentual =
      desc.tipo === "percentual"
        ? desc.valor
        : null;

    const valorFixo =
      desc.tipo === "valor_fixo"
        ? desc.valor
        : null;

    console.log(
      `PROMOCAO -> ${promotionId} | ${titulo} | tracking OK`
    );

    if (!CONFIRMAR) {
      continue;
    }

    const agora =
      new Date().toISOString();

    const origem =
      `agente_promocoes_awin_${config.slug}`;

    const bruto = {
      fonte: "awin",
      advertiser_id:
        Number(config.advertiserId),
      publisher_id:
        Number(PUBLISHER_ID),
      promotion_id:
        promotionId,
      awin: promocao
    };

    const oferta =
      await salvarOferta(
        dedupe,
        {
          loja_id: loja.id,
          tipo: "promocao",
          status: "ativo",
          titulo,
          descricao,
          codigo: null,
          categoria: null,
          regras,
          imagem_url:
            config.logoUrl ||
            loja.logo_url ||
            null,
          link_destino:
            linkDestino(promocao),
          link_afiliado:
            linkAfiliado(promocao),
          desconto_percentual:
            percentual,
          valor_desconto:
            valorFixo,
          cashback_percentual:
            null,
          pedido_minimo:
            pedidoMinimo(promocao),
          preco_original: null,
          preco_oferta: null,
          data_inicio:
            inicioItem(promocao),
          validade:
            validadeItem(promocao),
          destaque: false,
          selos:
            ["Promocao oficial Awin"],
          origem,
          origem_url:
            linkDestino(promocao),
          dedupe_key: dedupe,
          dados_brutos: bruto,
          coletado_em: agora,
          verificado_em: agora,
          updated_at: agora
        }
      );

    console.log(
      `  OK | oferta ${oferta.acao}`
    );
  }

  if (CONFIRMAR && loja.id) {
    const origemCupom =
      `agente_cupons_awin_${config.slug}`;

    const origemPromo =
      `agente_promocoes_awin_${config.slug}`;

    const expiradosCupom =
      await expirarAusentes(
        "economize_cupons",
        loja.id,
        origemCupom,
        ativosCupons
      );

    const expiradasOfertasCupom =
      await expirarAusentes(
        "economize_ofertas",
        loja.id,
        origemCupom,
        ativosOfertasCupom
      );

    const expiradasPromocoes =
      await expirarAusentes(
        "economize_ofertas",
        loja.id,
        origemPromo,
        ativosPromocoes
      );

    console.log(
      `Sincronizacao: cupons expirados=${expiradosCupom} | ofertas cupom expiradas=${expiradasOfertasCupom} | promocoes expiradas=${expiradasPromocoes}`
    );
  }
}

async function main() {
  const banco = await lojasBanco();

  console.log(
    CONFIRMAR
      ? "\n=== PUBLICACAO AWIN MULTILOJA ==="
      : "\n=== PREVIEW AWIN MULTILOJA ==="
  );

  for (const loja of lojas) {
    if (loja.monitorOnly) {
      console.log(`\n=== ${loja.nome.toUpperCase()} ===`);
      console.log(
        "MONITOR ONLY: coleta ativa; publicacao bloqueada ate o classificador dedicado de viagens."
      );
      continue;
    }

    await processarLoja(
      loja,
      banco
    );
  }

  if (!CONFIRMAR) {
    console.log(
      "\n=== MODO TESTE ==="
    );
    console.log(
      "Nenhum dado foi alterado."
    );
    console.log(
      "Voucher -> CUPONS | Promotion -> PROMOCOES"
    );
    console.log(
      "Execute novamente com CONFIRMAR para sincronizar."
    );
  } else {
    console.log(
      "\n=== AWIN MULTILOJA SINCRONIZADA ==="
    );
  }
}

main().catch((erro) => {
  console.error(
    "\nERRO:",
    erro.message || erro
  );

  process.exit(1);
});
