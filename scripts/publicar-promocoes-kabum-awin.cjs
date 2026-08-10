const fs = require("fs");
const path = require("path");
const {
  createClient,
} = require("@supabase/supabase-js");

const CONFIRMAR =
  process.argv
    .slice(2)
    .some(
      arg =>
        String(arg).toUpperCase() ===
        "CONFIRMAR"
    );

const ORIGEM =
  "agente_promocoes_awin_kabum";

const MARGEM_MINUTOS = 60;

const entradaPath = path.join(
  process.cwd(),
  "tmp",
  "promocoes-kabum-awin-selecionadas.json"
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

function precoOriginalValido(item) {
  const antigo =
    numero(item.precoAnterior);

  const atual =
    numero(item.precoAtual);

  if (
    antigo === null ||
    atual === null ||
    antigo <= atual
  ) {
    return null;
  }

  return antigo;
}

function descontoValido(item) {
  const desconto =
    numero(item.descontoReal);

  if (
    desconto === null ||
    desconto <= 0
  ) {
    return null;
  }

  return desconto;
}

function categoriaPublica(item) {
  const categoria =
    String(
      item.categoria || ""
    ).trim();

  if (categoria) {
    return categoria;
  }

  if (item.ehGpu) {
    return "Placas de Video";
  }

  return null;
}

function aindaValida(item) {
  const fim =
    Date.parse(
      item.validade || ""
    );

  if (!Number.isFinite(fim)) {
    return true;
  }

  return (
    fim >
    Date.now() +
      MARGEM_MINUTOS *
        60 *
        1000
  );
}

async function buscarPrimeiro(
  consulta
) {
  const {
    data,
    error,
  } = await consulta.limit(1);

  if (error) {
    throw error;
  }

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
        .select(
          "id,origem,dedupe_key"
        )
        .eq(
          "dedupe_key",
          dados.dedupe_key
        )
    );

  if (
    existente &&
    existente.origem !== ORIGEM
  ) {
    throw new Error(
      `Dedupe ${dados.dedupe_key} ja pertence a origem ${existente.origem}.`
    );
  }

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

    if (error) {
      throw error;
    }

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

  if (error) {
    throw error;
  }

  return {
    ...data,
    acao: "criada",
  };
}

async function main() {
  carregarEnvLocal();

  if (!fs.existsSync(entradaPath)) {
    throw new Error(
      "Arquivo de promocoes selecionadas nao encontrado."
    );
  }

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

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

  if (
    erroLoja ||
    !loja
  ) {
    throw new Error(
      "Loja KaBuM ativa nao encontrada."
    );
  }

  const entrada =
    JSON.parse(
      fs.readFileSync(
        entradaPath,
        "utf8"
      )
    );

  const selecionadas =
    (
      entrada.selecionadas ||
      []
    ).filter(item => {
      if (!item.linkAfiliado) {
        return false;
      }

      if (!item.imagem) {
        return false;
      }

      if (
        numero(item.precoAtual) === null
      ) {
        return false;
      }

      return aindaValida(item);
    });

  console.log("");
  console.log(
    "=== PREVIA PROMOCOES KABUM ==="
  );

  console.log(
    `Loja: ${loja.nome}`
  );

  console.log(
    `Selecionadas no ranking: ${
      entrada.selecionadas?.length || 0
    }`
  );

  console.log(
    `Validas para publicar: ${selecionadas.length}`
  );

  console.log("");

  for (
    const item of selecionadas
  ) {
    const antigo =
      precoOriginalValido(item);

    const desconto =
      descontoValido(item);

    console.log(
      `PROMOCAO: ${item.promotionId}`
    );

    console.log(
      `Produto: ${item.nome}`
    );

    console.log(
      `Preco atual: R$ ${item.precoAtual}`
    );

    console.log(
      `Preco anterior: ${
        antigo ??
        "nao identificado"
      }`
    );

    console.log(
      `Desconto comprovado: ${
        desconto !== null
          ? desconto + "%"
          : "nao identificado"
      }`
    );

    console.log(
      `Categoria DB: ${
        categoriaPublica(item) ||
        "nao identificada"
      }`
    );

    console.log(
      `GPU: ${
        item.ehGpu
          ? "SIM"
          : "NAO"
      }`
    );

    console.log(
      `Tracking Awin: ${
        item.linkAfiliado
          ? "OK"
          : "NAO"
      }`
    );

    console.log(
      `Validade: ${item.validade}`
    );

    console.log("");
  }

  if (!CONFIRMAR) {
    console.log(
      "=== MODO TESTE ==="
    );

    console.log(
      "Nenhuma promocao foi publicada."
    );

    console.log(
      "Execute novamente com CONFIRMAR para gravar."
    );

    return;
  }

  console.log("");
  console.log(
    "=== PUBLICANDO PROMOCOES KABUM ==="
  );

  let publicadas = 0;

  for (
    const item of selecionadas
  ) {
    const agora =
      new Date().toISOString();

    const precoAtual =
      numero(item.precoAtual);

    const precoAnterior =
      precoOriginalValido(item);

    const desconto =
      descontoValido(item);

    const promotionId =
      String(item.promotionId);

    const dedupeKey =
      `awin:kabum:promotion:${promotionId}`;

    const descricao =
      desconto !== null
        ? `${desconto}% de desconto nesta oferta selecionada da KaBuM!`
        : "Oferta selecionada da KaBuM!";

    const regras =
      "Oferta valida enquanto durarem os estoques e durante o periodo informado pela KaBuM.";

    const dados = {
      loja_id:
        loja.id,

      tipo:
        "promocao",

      status:
        "ativo",

      titulo:
        item.nome,

      descricao,

      codigo:
        null,

      categoria:
        categoriaPublica(item),

      regras,

      imagem_url:
        item.imagem,

      link_destino:
        item.urlProduto ||
        item.linkDestino,

      link_afiliado:
        item.linkAfiliado,

      desconto_percentual:
        desconto,

      valor_desconto:
        null,

      cashback_percentual:
        null,

      pedido_minimo:
        null,

      preco_original:
        precoAnterior,

      preco_oferta:
        precoAtual,

      data_inicio:
        item.inicio ||
        agora,

      validade:
        item.validade ||
        null,

      destaque:
        false,

      selos: [],

      origem:
        ORIGEM,

      origem_url:
        item.linkDestino,

      dedupe_key:
        dedupeKey,

      dados_brutos: {
        fonte:
          "awin",

        advertiser_id:
          item.advertiserId,

        promotion_id:
          item.promotionId,

        score_publicacao:
          item.scorePublicacao,

        grupo_ranking:
          item.grupo,

        motivos:
          item.motivosPublicacao,

        avaliacao:
          item.avaliacao,

        frete_gratis:
          item.freteGratis,

        gpu:
          Boolean(item.ehGpu),

        desconto_real:
          desconto,

        preco_anterior:
          precoAnterior,
      },

      coletado_em:
        agora,

      verificado_em:
        agora,

      updated_at:
        agora,
    };

    const resultado =
      await salvarOferta(
        supabase,
        dados
      );

    publicadas += 1;

    console.log(
      `OK ${promotionId} | ${resultado.acao} | ${resultado.id}`
    );
  }

  console.log("");
  console.log(
    "=== PROMOCOES KABUM PUBLICADAS ==="
  );

  console.log(
    `Publicadas/atualizadas: ${publicadas}`
  );
}

main().catch(erro => {
  console.error("");
  console.error(
    "ERRO PUBLICADOR PROMOCOES:"
  );

  console.error(
    erro instanceof Error
      ? erro.message
      : erro
  );

  process.exitCode = 1;
});
