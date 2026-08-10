const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

const ROOT = "/vercel";
const TMP = "/vercel/tmp";
const ENV_FILE = "/vercel/.env.local";
const LOCK_FILE = path.join(TMP, "kabum-awin.lock");
const LOG_FILE = path.join(TMP, "kabum-awin.log");
const STATUS_FILE = path.join(TMP, "kabum-awin-status.json");

const ORIGEM_CUPOM = "agente_cupons_awin_kabum";
const ORIGEM_PROMO = "agente_promocoes_awin_kabum";

const LOCK_TTL = 2 * 60 * 60 * 1000;

fs.mkdirSync(TMP, { recursive: true });

function agora() {
  return new Date().toISOString();
}

function log(msg) {
  const linha = `[${agora()}] ${msg}`;
  console.log(linha);
  fs.appendFileSync(LOG_FILE, linha + "\n", "utf8");
}

function remover(arquivo) {
  try {
    fs.unlinkSync(arquivo);
  } catch {}
}

function salvarStatus(dados) {
  fs.writeFileSync(
    STATUS_FILE,
    JSON.stringify(
      {
        atualizadoEm: agora(),
        ...dados,
      },
      null,
      2
    ),
    "utf8"
  );
}

function lockAtivo() {
  if (!fs.existsSync(LOCK_FILE)) {
    return false;
  }

  try {
    const stat = fs.statSync(LOCK_FILE);
    const idade = Date.now() - stat.mtimeMs;

    if (idade < LOCK_TTL) {
      return true;
    }
  } catch {}

  remover(LOCK_FILE);
  return false;
}

function obrigatoria(nome, alternativa) {
  const valor =
    process.env[nome] ||
    (alternativa ? process.env[alternativa] : "");

  if (!valor) {
    throw new Error(`Variavel ausente: ${nome}`);
  }

  return valor;
}

function criarEnvTemporario() {
  const vars = {
    AWIN_API_TOKEN:
      obrigatoria("AWIN_API_TOKEN"),

    AWIN_PUBLISHER_ID:
      process.env.AWIN_PUBLISHER_ID || "2922231",

    NEXT_PUBLIC_SUPABASE_URL:
      obrigatoria(
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_URL"
      ),

    SUPABASE_SERVICE_ROLE_KEY:
      obrigatoria(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY"
      ),
  };

  const conteudo =
    Object.entries(vars)
      .map(([k, v]) => `${k}=${JSON.stringify(String(v))}`)
      .join("\n") + "\n";

  fs.writeFileSync(
    ENV_FILE,
    conteudo,
    {
      encoding: "utf8",
      mode: 0o600,
    }
  );
}

function executar(nome, script, args = []) {
  log(`INICIO ${nome}`);

  const arquivo = path.join(
    ROOT,
    "scripts",
    script
  );

  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `Script nao encontrado: ${arquivo}`
    );
  }

  const resultado = spawnSync(
    process.execPath,
    [arquivo, ...args],
    {
      cwd: ROOT,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    }
  );

  if (resultado.stdout) {
    fs.appendFileSync(
      LOG_FILE,
      resultado.stdout + "\n",
      "utf8"
    );
  }

  if (resultado.stderr) {
    fs.appendFileSync(
      LOG_FILE,
      resultado.stderr + "\n",
      "utf8"
    );
  }

  if (resultado.status !== 0) {
    throw new Error(
      `${nome} falhou com exit code ${resultado.status}`
    );
  }

  log(`OK ${nome}`);
}

function carregarJson(nome) {
  const arquivo = path.join(TMP, nome);

  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `JSON nao encontrado: ${arquivo}`
    );
  }

  return JSON.parse(
    fs.readFileSync(arquivo, "utf8")
  );
}

function validadeOk(valor, margemMinutos) {
  const fim = Date.parse(valor || "");

  if (!Number.isFinite(fim)) {
    return true;
  }

  return (
    fim >
    Date.now() +
      margemMinutos * 60 * 1000
  );
}

async function expirarIds(
  supabase,
  tabela,
  ids
) {
  if (!ids.length) {
    return 0;
  }

  const instante = agora();

  const { error } = await supabase
    .from(tabela)
    .update({
      validade: instante,
      verificado_em: instante,
      updated_at: instante,
    })
    .in("id", ids);

  if (error) {
    throw error;
  }

  return ids.length;
}

async function sincronizarPublicacoes() {
  log("INICIO sincronizacao de publicacoes");

  const validados =
    carregarJson(
      "cupons-kabum-awin-validados.json"
    );

  const selecao =
    carregarJson(
      "promocoes-kabum-awin-selecionadas.json"
    );

  const codigosAtivos = new Set(
    (validados.cupons || [])
      .filter(
        (item) =>
          item.validacao?.elegibilidadeAutomatica === true &&
          validadeOk(item.validade, 30)
      )
      .map((item) =>
        String(item.codigo || "")
          .trim()
          .toUpperCase()
      )
      .filter(Boolean)
  );

  const promocoesAtivas = new Set(
    (selecao.selecionadas || [])
      .filter((item) =>
        validadeOk(item.validade, 60)
      )
      .map(
        (item) =>
          `awin:kabum:promotion:${item.promotionId}`
      )
  );

  const supabaseUrl =
    obrigatoria(
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_URL"
    );

  const serviceKey =
    obrigatoria(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY"
    );

  const supabase = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: loja,
    error: erroLoja,
  } = await supabase
    .from("economize_lojas")
    .select("id")
    .eq("slug", "kabum")
    .eq("ativa", true)
    .single();

  if (erroLoja || !loja) {
    throw new Error(
      "Loja KaBuM ativa nao encontrada."
    );
  }

  const {
    data: cupons,
    error: erroCupons,
  } = await supabase
    .from("economize_cupons")
    .select("id,codigo")
    .eq("loja_id", loja.id)
    .eq("origem", ORIGEM_CUPOM)
    .eq("status", "ativo");

  if (erroCupons) {
    throw erroCupons;
  }

  const cuponsExpirar =
    (cupons || [])
      .filter(
        (item) =>
          !codigosAtivos.has(
            String(item.codigo || "")
              .trim()
              .toUpperCase()
          )
      )
      .map((item) => item.id);

  const {
    data: ofertasCupom,
    error: erroOfertasCupom,
  } = await supabase
    .from("economize_ofertas")
    .select("id,codigo")
    .eq("loja_id", loja.id)
    .eq("origem", ORIGEM_CUPOM)
    .eq("status", "ativo");

  if (erroOfertasCupom) {
    throw erroOfertasCupom;
  }

  const ofertasCupomExpirar =
    (ofertasCupom || [])
      .filter(
        (item) =>
          !codigosAtivos.has(
            String(item.codigo || "")
              .trim()
              .toUpperCase()
          )
      )
      .map((item) => item.id);

  const {
    data: promocoes,
    error: erroPromocoes,
  } = await supabase
    .from("economize_ofertas")
    .select("id,dedupe_key")
    .eq("loja_id", loja.id)
    .eq("origem", ORIGEM_PROMO)
    .eq("status", "ativo");

  if (erroPromocoes) {
    throw erroPromocoes;
  }

  const promocoesExpirar =
    (promocoes || [])
      .filter(
        (item) =>
          !promocoesAtivas.has(
            String(item.dedupe_key || "")
          )
      )
      .map((item) => item.id);

  const n1 = await expirarIds(
    supabase,
    "economize_cupons",
    cuponsExpirar
  );

  const n2 = await expirarIds(
    supabase,
    "economize_ofertas",
    ofertasCupomExpirar
  );

  const n3 = await expirarIds(
    supabase,
    "economize_ofertas",
    promocoesExpirar
  );

  log(
    `SINCRONIZACAO OK | cupons expirados=${n1} | ofertas cupom expiradas=${n2} | promocoes antigas expiradas=${n3}`
  );
}

async function main() {
  if (lockAtivo()) {
    log(
      "Execucao anterior ainda ativa. Ignorando nova chamada."
    );

    salvarStatus({
      sucesso: true,
      ignorada: true,
      motivo: "execucao_em_andamento",
    });

    return;
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({
      inicio: agora(),
      pid: process.pid,
    }),
    "utf8"
  );

  salvarStatus({
    sucesso: null,
    executando: true,
    inicio: agora(),
  });

  try {
    criarEnvTemporario();

    executar(
      "coleta vouchers",
      "coletar-cupons-kabum-awin.cjs"
    );

    executar(
      "enriquecimento vouchers",
      "enriquecer-cupons-kabum-awin.cjs"
    );

    executar(
      "validacao vouchers",
      "validar-elegibilidade-kabum-awin.cjs"
    );

    executar(
      "publicacao vouchers",
      "publicar-cupons-kabum-awin.cjs",
      ["CONFIRMAR"]
    );

    executar(
      "coleta promocoes",
      "coletar-promocoes-kabum-awin.cjs"
    );

    executar(
      "enriquecimento promocoes",
      "enriquecer-promocoes-kabum-awin.cjs"
    );

    executar(
      "ranking promocoes",
      "selecionar-promocoes-kabum-awin.cjs"
    );

    executar(
      "publicacao promocoes",
      "publicar-promocoes-kabum-awin.cjs",
      ["CONFIRMAR"]
    );

    await sincronizarPublicacoes();

    salvarStatus({
      sucesso: true,
      executando: false,
      fim: agora(),
    });

    log(
      "PIPELINE KABUM/AWIN CONCLUIDO COM SUCESSO"
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(erro);

    log(`ERRO ${mensagem}`);

    salvarStatus({
      sucesso: false,
      executando: false,
      erro: mensagem,
      fim: agora(),
    });

    process.exitCode = 1;
  } finally {
    remover(ENV_FILE);
    remover(LOCK_FILE);
  }
}

main();