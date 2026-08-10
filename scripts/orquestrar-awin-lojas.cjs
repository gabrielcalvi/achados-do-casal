const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = "/vercel";
const TMP = "/vercel/tmp";
const ENV_FILE = "/vercel/.env.local";

const LOCK_FILE =
  path.join(TMP, "awin-multiloja.lock");

const STATUS_FILE =
  path.join(TMP, "awin-multiloja-status.json");

const LOG_FILE =
  path.join(TMP, "awin-multiloja.log");

const LOCK_TTL =
  60 * 60 * 1000;

fs.mkdirSync(TMP, {
  recursive: true
});

function agora() {
  return new Date().toISOString();
}

function log(texto) {
  const linha =
    `[${agora()}] ${texto}`;

  console.log(linha);

  fs.appendFileSync(
    LOG_FILE,
    linha + "\n",
    "utf8"
  );
}

function remover(arquivo) {
  try {
    fs.unlinkSync(arquivo);
  } catch {}
}

function status(dados) {
  fs.writeFileSync(
    STATUS_FILE,
    JSON.stringify(
      {
        atualizadoEm: agora(),
        ...dados
      },
      null,
      2
    ),
    "utf8"
  );
}

function obrigatoria(
  nome,
  alternativa
) {
  const valor =
    process.env[nome] ||
    (
      alternativa
        ? process.env[alternativa]
        : ""
    );

  if (!valor) {
    throw new Error(
      `Variavel ausente: ${nome}`
    );
  }

  return valor;
}

function lockAtivo() {
  if (!fs.existsSync(LOCK_FILE)) {
    return false;
  }

  try {
    const stat =
      fs.statSync(LOCK_FILE);

    const idade =
      Date.now() - stat.mtimeMs;

    if (idade < LOCK_TTL) {
      return true;
    }
  } catch {}

  remover(LOCK_FILE);

  return false;
}

function criarEnvTemporario() {
  const dados = {
    AWIN_API_TOKEN:
      obrigatoria(
        "AWIN_API_TOKEN"
      ),

    AWIN_PUBLISHER_ID:
      process.env.AWIN_PUBLISHER_ID ||
      "2922231",

    NEXT_PUBLIC_SUPABASE_URL:
      obrigatoria(
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_URL"
      ),

    SUPABASE_SERVICE_ROLE_KEY:
      obrigatoria(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY"
      )
  };

  const conteudo =
    Object.entries(dados)
      .map(
        ([chave, valor]) =>
          `${chave}=${JSON.stringify(String(valor))}`
      )
      .join("\n") +
    "\n";

  fs.writeFileSync(
    ENV_FILE,
    conteudo,
    {
      encoding: "utf8",
      mode: 0o600
    }
  );
}

function executar(
  nome,
  script,
  args = []
) {
  log(`INICIO ${nome}`);

  const arquivo =
    path.join(
      ROOT,
      "scripts",
      script
    );

  if (!fs.existsSync(arquivo)) {
    throw new Error(
      `Script nao encontrado: ${arquivo}`
    );
  }

  const resultado =
    spawnSync(
      process.execPath,
      [
        arquivo,
        ...args
      ],
      {
        cwd: ROOT,
        env: process.env,
        encoding: "utf8",
        maxBuffer:
          30 * 1024 * 1024
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

async function main() {
  if (lockAtivo()) {
    log(
      "Execucao anterior ainda ativa. Ignorando."
    );

    status({
      sucesso: true,
      ignorada: true,
      motivo:
        "execucao_em_andamento"
    });

    return;
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({
      pid: process.pid,
      inicio: agora()
    }),
    "utf8"
  );

  status({
    executando: true,
    sucesso: null,
    inicio: agora()
  });

  try {
    criarEnvTemporario();

    const lojas = [
      "cea",
      "renner",
      "calvin-klein",
      "stanley"
    ];

    for (const loja of lojas) {
      executar(
        `${loja} vouchers`,
        "coletar-awin-loja.cjs",
        [
          loja,
          "cupons"
        ]
      );

      executar(
        `${loja} promocoes`,
        "coletar-awin-loja.cjs",
        [
          loja,
          "promocoes"
        ]
      );
    }

    executar(
      "publicacao e sincronizacao",
      "publicar-awin-lojas.cjs",
      [
        "CONFIRMAR"
      ]
    );

    status({
      executando: false,
      sucesso: true,
      fim: agora(),
      lojas: [
        "cea",
        "renner",
        "calvin-klein",
        "stanley"
      ]
    });

    log(
      "AWIN MULTILOJA CONCLUIDA COM SUCESSO"
    );
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : String(erro);

    log(
      `ERRO ${mensagem}`
    );

    status({
      executando: false,
      sucesso: false,
      erro: mensagem,
      fim: agora()
    });

    process.exitCode = 1;
  } finally {
    remover(ENV_FILE);
    remover(LOCK_FILE);
  }
}

main();
