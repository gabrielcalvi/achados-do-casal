const fs = require("fs");
const path = require("path");
const {
  createClient,
} = require("@supabase/supabase-js");

const CONFIRMAR =
  process.argv
    .slice(2)
    .some(
      (arg) =>
        String(arg).toUpperCase() ===
        "CONFIRMAR"
    );

const MARGEM_MINUTOS = 30;

const ORIGEM_CANDIDATO =
  "awin_kabum";

const ORIGEM_PUBLICA =
  "agente_cupons_awin_kabum";

const arquivoEntrada = path.join(
  process.cwd(),
  "tmp",
  "cupons-kabum-awin-validados.json"
);

function carregarEnvLocal() {
  const arquivo = path.join(
    process.cwd(),
    ".env.local"
  );

  if (!fs.existsSync(arquivo)) {
    throw new Error(
      ".env.local nao encontrado."
    );
  }

  const linhas = fs
    .readFileSync(arquivo, "utf8")
    .split(/\r?\n/);

  for (const original of linhas) {
    const linha = original.trim();

    if (
      !linha ||
      linha.startsWith("#")
    ) {
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
      (
        valor.startsWith('"') &&
        valor.endsWith('"')
      ) ||
      (
        valor.startsWith("'") &&
        valor.endsWith("'")
      )
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

function numero(valor) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}

function numeroPtBr(texto) {
  const valor = String(texto || "")
    .replace(/\./g, "")
    .replace(",", ".");

  return numero(valor);
}

function textoLimpo(texto) {
  return String(texto || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function montarRegrasKabum(termos) {
  const original =
    textoLimpo(termos);

  const conteudoUtil =
    original
      .replace(
        /[\s.\-_/]+/g,
        ""
      )
      .trim();

  const temTermoUtil =
    conteudoUtil.length >= 3;

  let regras =
    temTermoUtil
      ? original
      : "Cupom oficial disponibilizado pela KaBuM via Awin. Valido somente para o produto elegivel indicado.";

  if (
    !/disponibilidade do lote de cupons/i.test(
      regras
    )
  ) {
    regras +=
      " Sujeito a disponibilidade do lote de cupons.";
  }

  if (
    !/durarem os estoques|disponibilidade de estoque/i.test(
      regras
    )
  ) {
    regras +=
      " Oferta valida enquanto durarem os estoques.";
  }

  return regras
    .replace(/\s+/g, " ")
    .trim();
}

function extrairPedidoMinimo(termos) {
  const texto = textoLimpo(termos);

  const padroes = [
    /(?:compra|pedido)\s+m[ií]nim[oa][^R$]{0,40}R\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /compras?\s+(?:acima|a partir)\s+de\s+R\$\s*([\d.]+(?:,\d{1,2})?)/i,
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);

    if (match) {
      return numeroPtBr(match[1]);
    }
  }

  return null;
}

function extrairLimiteDesconto(termos) {
  const texto = textoLimpo(termos);

  const padroes = [
    /desconto\s+m[aá]ximo[^R$]{0,40}R\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /limite\s+(?:de\s+)?desconto[^R$]{0,40}R\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /limitado\s+a\s+R\$\s*([\d.]+(?:,\d{1,2})?)/i,
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);

    if (match) {
      return numeroPtBr(match[1]);
    }
  }

  return null;
}

function beneficioTexto(cupom) {
  const valor =
    numero(cupom.valorDesconto);

  if (
    cupom.tipoDesconto ===
      "percentual" &&
    valor !== null
  ) {
    return `${valor}% OFF`;
  }

  if (
    cupom.tipoDesconto ===
      "valor_fixo" &&
    valor !== null
  ) {
    return (
      `R$ ${valor
        .toFixed(2)
        .replace(".", ",")} OFF`
    );
  }

  return cupom.titulo || "Cupom";
}

function calcularPreco({
  preco,
  tipo,
  valor,
  pedidoMinimo,
  limiteDesconto,
}) {
  const p = numero(preco);
  const v = numero(valor);

  if (
    p === null ||
    p <= 0 ||
    v === null ||
    v <= 0
  ) {
    return null;
  }

  if (
    pedidoMinimo !== null &&
    p < pedidoMinimo
  ) {
    return null;
  }

  let desconto = null;

  if (tipo === "percentual") {
    desconto = p * (v / 100);
  } else if (
    tipo === "valor_fixo"
  ) {
    desconto = v;
  }

  if (
    desconto === null ||
    desconto <= 0
  ) {
    return null;
  }

  if (
    limiteDesconto !== null
  ) {
    desconto = Math.min(
      desconto,
      limiteDesconto
    );
  }

  const final =
    Math.round(
      Math.max(
        0,
        p - desconto
      ) * 100
    ) / 100;

  if (
    final <= 0 ||
    final >= p
  ) {
    return null;
  }

  return final;
}

function idProduto(url) {
  const match =
    String(url || "").match(
      /\/produto\/(\d+)/i
    );

  return match
    ? match[1]
    : "direto";
}

async function buscarPrimeiro(
  consulta
) {
  const {
    data,
    error,
  } = await consulta.limit(1);

  if (error) throw error;

  return data?.[0] || null;
}

async function salvarOferta(
  supabase,
  dados
) {
  const existente =
    await buscarPrimeiro(
      supabase
        .from("economize_ofertas")
        .select("id,origem")
        .eq(
          "dedupe_key",
          dados.dedupe_key
        )
    );

  if (existente) {
    const {
      data,
      error,
    } = await supabase
      .from("economize_ofertas")
      .update(dados)
      .eq("id", existente.id)
      .select("id,titulo")
      .single();

    if (error) throw error;

    return {
      ...data,
      acao: "atualizada",
    };
  }

  const {
    data,
    error,
  } = await supabase
    .from("economize_ofertas")
    .insert(dados)
    .select("id,titulo")
    .single();

  if (error) throw error;

  return {
    ...data,
    acao: "criada",
  };
}

async function salvarCupom(
  supabase,
  lojaId,
  dados
) {
  const existente =
    await buscarPrimeiro(
      supabase
        .from("economize_cupons")
        .select(
          "id,origem,codigo"
        )
        .eq("loja_id", lojaId)
        .eq(
          "codigo",
          dados.codigo
        )
    );

  if (
    existente &&
    existente.origem !==
      ORIGEM_PUBLICA
  ) {
    throw new Error(
      `Cupom ${dados.codigo} ja existe na KaBuM com origem "${existente.origem}". Nao sera sobrescrito automaticamente.`
    );
  }

  if (existente) {
    const {
      data,
      error,
    } = await supabase
      .from("economize_cupons")
      .update(dados)
      .eq("id", existente.id)
      .select("id,codigo")
      .single();

    if (error) throw error;

    return {
      ...data,
      acao: "atualizado",
    };
  }

  const {
    data,
    error,
  } = await supabase
    .from("economize_cupons")
    .insert(dados)
    .select("id,codigo")
    .single();

  if (error) throw error;

  return {
    ...data,
    acao: "criado",
  };
}

async function salvarCandidato(
  supabase,
  cupom,
  produto,
  agora
) {
  const campanhaId =
    String(cupom.promotionId);

  const existente =
    await buscarPrimeiro(
      supabase
        .from(
          "economize_cupons_candidatos"
        )
        .select(
          "id,primeira_coleta_em"
        )
        .eq(
          "origem",
          ORIGEM_CANDIDATO
        )
        .eq(
          "campanha_externa_id",
          campanhaId
        )
    );

  const score =
    Math.round(
      numero(
        produto.scoreProduto
      ) || 0
    );

  const faixa =
    score >= 55
      ? "forte"
      : score >= 40
      ? "promissor"
      : "fraco";

  const dados = {
    origem:
      ORIGEM_CANDIDATO,

    campanha_externa_id:
      campanhaId,

    vendedor_nome:
      "KaBuM!",

    vendedor_externo_id:
      String(
        cupom.advertiserId ||
          17729
      ),

    titulo:
      beneficioTexto(cupom),

    tipo_desconto:
      cupom.tipoDesconto,

    valor_desconto:
      numero(
        cupom.valorDesconto
      ),

    orcamento_restante:
      null,

    validade:
      cupom.validade,

    em_uso:
      true,

    quantidade_cupons_vendedor:
      1,

    prioridade_previa:
      0,

    score_demanda:
      score,

    faixa,

    motivos: [
      "voucher oficial Awin",
      "destino direto para produto",
      "elegibilidade automatica validada",
    ],

    resumo_produtos: {
      total_resultados: 1,
      produtos_visiveis: 1,
      avaliacao:
        produto.avaliacao ??
        null,
      preco_atual:
        produto.precoAtual ??
        null,
    },

    top_produtos: [
      produto,
    ],

    url_produtos:
      produto.urlProduto,

    status:
      "aprovado",

    dados_brutos: {
      fonte: "awin",
      advertiser_id:
        cupom.advertiserId,
      promotion_id:
        cupom.promotionId,
      codigo:
        cupom.codigo,
      link_tracking:
        cupom.linkAfiliado,
      validacao:
        cupom.validacao,
      termos:
        cupom.termos,
    },

    ultima_coleta_em:
      agora,

    analisado_em:
      agora,

    aprovado_em:
      agora,

    updated_at:
      agora,
  };

  if (existente) {
    const {
      data,
      error,
    } = await supabase
      .from(
        "economize_cupons_candidatos"
      )
      .update(dados)
      .eq("id", existente.id)
      .select("id")
      .single();

    if (error) throw error;

    return data;
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "economize_cupons_candidatos"
    )
    .insert({
      ...dados,
      primeira_coleta_em:
        agora,
    })
    .select("id")
    .single();

  if (error) throw error;

  return data;
}

async function main() {
  carregarEnvLocal();

  if (
    !fs.existsSync(
      arquivoEntrada
    )
  ) {
    throw new Error(
      "cupons-kabum-awin-validados.json nao encontrado."
    );
  }

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    process.env
      .SUPABASE_SERVICE_KEY;

  if (
    !supabaseUrl ||
    !serviceKey
  ) {
    throw new Error(
      "Supabase nao configurado."
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken:
            false,
          persistSession:
            false,
        },
      }
    );

  const {
    data: loja,
    error: erroLoja,
  } = await supabase
    .from("economize_lojas")
    .select(
      "id,nome,slug,ativa"
    )
    .eq("slug", "kabum")
    .eq("ativa", true)
    .single();

  if (erroLoja || !loja) {
    throw new Error(
      "Loja KaBuM ativa nao encontrada."
    );
  }

  const entrada =
    JSON.parse(
      fs.readFileSync(
        arquivoEntrada,
        "utf8"
      )
    );

  const agoraData =
    new Date();

  const limiteValidade =
    agoraData.getTime() +
    MARGEM_MINUTOS *
      60 *
      1000;

  const preparados = [];
  const bloqueados = [];

  for (
    const cupom of
    entrada.cupons || []
  ) {
    const produto =
      cupom.produtoDestaque;

    if (
      !cupom.validacao
        ?.elegibilidadeAutomatica
    ) {
      bloqueados.push({
        codigo: cupom.codigo,
        motivo:
          "elegibilidade nao validada",
      });

      continue;
    }

    if (!produto) {
      bloqueados.push({
        codigo: cupom.codigo,
        motivo:
          "sem produto destaque",
      });

      continue;
    }

    const validade =
      Date.parse(
        cupom.validade || ""
      );

    if (
      !Number.isFinite(validade) ||
      validade <= limiteValidade
    ) {
      bloqueados.push({
        codigo: cupom.codigo,
        motivo:
          `validade inferior a ${MARGEM_MINUTOS} minutos`,
      });

      continue;
    }

    if (
      !cupom.linkAfiliado
    ) {
      bloqueados.push({
        codigo: cupom.codigo,
        motivo:
          "sem urlTracking da Awin",
      });

      continue;
    }

    const pedidoMinimo =
      extrairPedidoMinimo(
        cupom.termos
      );

    const limiteDesconto =
      extrairLimiteDesconto(
        cupom.termos
      );

    const precoOferta =
      calcularPreco({
        preco:
          produto.precoAtual,
        tipo:
          cupom.tipoDesconto,
        valor:
          cupom.valorDesconto,
        pedidoMinimo,
        limiteDesconto,
      });

    if (
      precoOferta === null
    ) {
      bloqueados.push({
        codigo: cupom.codigo,
        motivo:
          "preco com cupom nao passou na validacao",
      });

      continue;
    }

    preparados.push({
      cupom,
      produto,
      pedidoMinimo,
      limiteDesconto,
      precoOferta,
    });
  }

  console.log("");
  console.log(
    "=== PREVIA PUBLICACAO KABUM ==="
  );

  console.log(
    `Loja: ${loja.nome}`
  );

  console.log(
    `Elegiveis para publicar: ${preparados.length}`
  );

  console.log(
    `Bloqueados: ${bloqueados.length}`
  );

  console.log("");

  for (
    const item of preparados
  ) {
    const {
      cupom,
      produto,
      pedidoMinimo,
      limiteDesconto,
      precoOferta,
    } = item;

    console.log(
      `CUPOM: ${cupom.codigo}`
    );

    console.log(
      `Beneficio: ${beneficioTexto(cupom)}`
    );

    console.log(
      `Produto: ${produto.nome}`
    );

    console.log(
      `Preco atual: R$ ${produto.precoAtual}`
    );

    console.log(
      `Preco calculado: R$ ${precoOferta}`
    );

    console.log(
      `Pedido minimo: ${
        pedidoMinimo ??
        "nao identificado"
      }`
    );

    console.log(
      `Limite desconto: ${
        limiteDesconto ??
        "nao identificado"
      }`
    );

    console.log(
      `Validade: ${cupom.validade}`
    );

    console.log(
      `Tracking Awin: ${
        cupom.linkAfiliado
          ? "OK"
          : "NAO"
      }`
    );

    console.log(
      `Regras finais: ${
        montarRegrasKabum(
          cupom.termos
        ).slice(0, 700)
      }`
    );

    console.log("");
  }

  console.log(
    "=== BLOQUEADOS ==="
  );

  for (
    const item of bloqueados
  ) {
    console.log(
      `${item.codigo} | ${item.motivo}`
    );
  }

  if (!CONFIRMAR) {
    console.log("");
    console.log(
      "=== MODO TESTE ==="
    );

    console.log(
      "Nenhum dado foi alterado."
    );

    console.log(
      "Para publicar, execute novamente com CONFIRMAR."
    );

    return;
  }

  console.log("");
  console.log(
    "=== PUBLICANDO ==="
  );

  let publicados = 0;

  for (
    const item of preparados
  ) {
    const {
      cupom,
      produto,
      pedidoMinimo,
      limiteDesconto,
      precoOferta,
    } = item;

    const agora =
      new Date().toISOString();

    const campanhaId =
      String(
        cupom.promotionId
      );

    const codigo =
      String(
        cupom.codigo
      ).trim();

    const beneficio =
      beneficioTexto(cupom);

    const itemId =
      idProduto(
        produto.urlProduto
      );

    console.log(
      `Publicando ${codigo}...`
    );

    const candidato =
      await salvarCandidato(
        supabase,
        cupom,
        produto,
        agora
      );

    const descontoPercentual =
      cupom.tipoDesconto ===
      "percentual"
        ? numero(
            cupom.valorDesconto
          )
        : null;

    const valorDesconto =
      cupom.tipoDesconto ===
      "valor_fixo"
        ? numero(
            cupom.valorDesconto
          )
        : null;

    const regras =
      montarRegrasKabum(
        cupom.termos
      );

    const ofertaDedupe =
      `awin:kabum:cupom:${campanhaId}:produto:${itemId}`;

    const cupomDedupe =
      `awin:kabum:cupom:${codigo.toUpperCase()}`;

    const oferta =
      await salvarOferta(
        supabase,
        {
          loja_id:
            loja.id,

          tipo:
            "cupom",

          status:
            "ativo",

          titulo:
            produto.nome,

          descricao:
            `${beneficio} com o cupom ${codigo} neste produto elegivel na KaBuM!`,

          codigo,

          categoria:
            produto.categoria ||
            null,

          regras,

          imagem_url:
            produto.imagem ||
            null,

          link_destino:
            produto.urlProduto,

          link_afiliado:
            cupom.linkAfiliado,

          desconto_percentual:
            descontoPercentual,

          valor_desconto:
            valorDesconto,

          cashback_percentual:
            null,

          pedido_minimo:
            pedidoMinimo,

          preco_original:
            numero(
              produto.precoAtual
            ),

          preco_oferta:
            precoOferta,

          data_inicio:
            cupom.inicio ||
            agora,

          validade:
            cupom.validade,

          destaque:
            false,

          selos: [],

          origem:
            ORIGEM_PUBLICA,

          origem_url:
            cupom.linkDestino,

          dedupe_key:
            ofertaDedupe,

          dados_brutos: {
            fonte:
              "awin",
            advertiser_id:
              cupom.advertiserId,
            promotion_id:
              cupom.promotionId,
            codigo,
            validacao:
              cupom.validacao,
            produto,
            pedido_minimo:
              pedidoMinimo,
            limite_desconto:
              limiteDesconto,
          },

          coletado_em:
            agora,

          verificado_em:
            agora,

          updated_at:
            agora,
        }
      );

    const cupomDb =
      await salvarCupom(
        supabase,
        loja.id,
        {
          loja_id:
            loja.id,

          status:
            "ativo",

          codigo,

          titulo:
            beneficio,

          descricao:
            `${beneficio} neste produto elegivel na KaBuM!`,

          regras,

          tipo_desconto:
            cupom.tipoDesconto,

          desconto_percentual:
            descontoPercentual,

          valor_desconto:
            valorDesconto,

          pedido_minimo:
            pedidoMinimo,

          limite_desconto:
            limiteDesconto,

          publico_alvo:
            null,

          elegibilidade:
            "Produto indicado diretamente pelo voucher oficial da KaBuM na Awin.",

          limite_por_usuario:
            null,

          somente_app:
            false,

          exige_mercado_pago:
            false,

          data_inicio:
            cupom.inicio ||
            agora,

          validade:
            cupom.validade,

          link_destino:
            produto.urlProduto,

          link_afiliado:
            cupom.linkAfiliado,

          origem:
            ORIGEM_PUBLICA,

          origem_url:
            cupom.linkDestino,

          dedupe_key:
            cupomDedupe,

          dados_brutos: {
            fonte:
              "awin",
            advertiser_id:
              cupom.advertiserId,
            promotion_id:
              cupom.promotionId,
            codigo,
            produto:
              produto.nome,
          },

          coletado_em:
            agora,

          verificado_em:
            agora,

          updated_at:
            agora,
        }
      );

    const vinculoExistente =
      await buscarPrimeiro(
        supabase
          .from(
            "economize_cupons_ofertas"
          )
          .select(
            "cupom_id,oferta_id"
          )
          .eq(
            "cupom_id",
            cupomDb.id
          )
          .eq(
            "oferta_id",
            oferta.id
          )
      );

    if (!vinculoExistente) {
      const {
        error:
          erroVinculo,
      } = await supabase
        .from(
          "economize_cupons_ofertas"
        )
        .insert({
          cupom_id:
            cupomDb.id,
          oferta_id:
            oferta.id,
        });

      if (erroVinculo) {
        throw erroVinculo;
      }
    }

    const {
      error:
        erroCandidato,
    } = await supabase
      .from(
        "economize_cupons_candidatos"
      )
      .update({
        cupom_publicado_id:
          cupomDb.id,

        status:
          "publicado",

        publicado_em:
          agora,

        updated_at:
          agora,
      })
      .eq(
        "id",
        candidato.id
      );

    if (erroCandidato) {
      throw erroCandidato;
    }

    publicados += 1;

    console.log(
      `OK ${codigo} | oferta ${oferta.id} | cupom ${cupomDb.id}`
    );
  }

  console.log("");
  console.log(
    "=== KABUM PUBLICADA ==="
  );

  console.log(
    `Publicados: ${publicados}`
  );

  console.log(
    `Bloqueados: ${bloqueados.length}`
  );
}

main().catch((erro) => {
  console.error("");
  console.error(
    "ERRO KABUM:"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exitCode = 1;
});
