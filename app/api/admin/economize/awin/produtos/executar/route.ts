import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/scripts/varrer-produtos-awin-legacy.cjs";
const WRAPPER_PATH = "/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs";
const CONFIG_PATH = "/vercel/scripts/awin-lojas.config.cjs";
const STATUS_PATH = "/vercel/tmp/awin-produtos-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-resultado.json";
const LOG_PATH = "/vercel/tmp/awin-produtos.log";
const EXIT_PATH = "/vercel/tmp/awin-produtos-exit.txt";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function autorizado(request: NextRequest) {
  return autorizadoComoCron(request) || usuarioAutenticado();
}

async function comando(sandbox: SandboxInstancia, cmd: string, args: string[], env?: Record<string, string>) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel", env });
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();
  return { resultado, stdout, stderr };
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const leitura = await comando(sandbox, "cat", [caminho]);
  if (leitura.resultado.exitCode !== 0 || !leitura.stdout) return null;
  try { return JSON.parse(leitura.stdout) as Record<string, unknown>; } catch { return null; }
}

async function processoVarreduraAtivo(sandbox: SandboxInstancia) {
  const processos = await comando(sandbox, "ps", ["-eo", "pid=,args="]);
  if (processos.resultado.exitCode !== 0) return false;
  return processos.stdout.split("\n").some((linha) => {
    const valor = linha.trim();
    return valor.includes("node") && (
      valor.includes("varrer-produtos-awin-legacy-wrapper.cjs") ||
      valor.includes("varrer-produtos-awin-legacy-normalizado.cjs") ||
      valor.includes("varrer-produtos-awin-legacy.cjs")
    );
  });
}

async function status(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const dados = (await lerJson(sandbox, STATUS_PATH)) || (await lerJson(sandbox, RESULT_PATH)) || { executando: false, mensagem: "Nenhuma varredura executada ainda." };
    return NextResponse.json({ sucesso: true, sandbox: SANDBOX_NAME, status: dados });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ sucesso: false, erro: "Variaveis AWIN/Data Feed/Supabase incompletas." }, { status: 500 });
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await comando(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos = [
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`, SCRIPT_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy-wrapper.cjs`, WRAPPER_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`, CONFIG_PATH],
    ];

    for (const [url, destino] of arquivos) {
      const download = await comando(sandbox, "curl", ["-fsSL", "--max-time", "30", url, "-o", destino]);
      if (download.resultado.exitCode !== 0) throw new Error(download.stderr || `Falha sincronizando ${destino}.`);
    }

    const timeoutPatch = await comando(sandbox, "sed", [
      "-i",
      "s/AbortSignal.timeout(240000)/AbortSignal.timeout(900000)/g",
      SCRIPT_PATH,
    ]);
    if (timeoutPatch.resultado.exitCode !== 0) {
      throw new Error(timeoutPatch.stderr || "Falha ao ampliar timeout do feed C&A.");
    }

    const patchFeed = await comando(sandbox, "node", [
      "-e",
      `const fs=require('fs');const p=${JSON.stringify(SCRIPT_PATH)};let c=fs.readFileSync(p,'utf8');const a='const feeds = feedsDaLoja(listaFeeds, loja);';const b='const feedsEncontrados = feedsDaLoja(listaFeeds, loja);\\n      const feeds = loja.slug === "cea" ? feedsEncontrados.slice(-1) : feedsEncontrados;';if(!c.includes(a))process.exit(2);c=c.replace(a,b);fs.writeFileSync(p,c);`,
    ]);
    if (patchFeed.resultado.exitCode !== 0) {
      throw new Error(patchFeed.stderr || "Falha ao selecionar feed atual da C&A.");
    }

    // O feed atual da C&A ainda e muito grande. Para a vitrine nao precisamos percorrer
    // centenas de milhares de linhas toda vez: coletamos uma amostra ampla de 30 mil
    // linhas, mantemos os melhores/diversificados e encerramos o download de forma limpa.
    // Isso reduz uma coleta de varios minutos para uma rotina recorrente previsivel.
    const patchLimite = await comando(sandbox, "node", [
      "-e",
      `const fs=require('fs');const p=${JSON.stringify(SCRIPT_PATH)};let c=fs.readFileSync(p,'utf8');const a='      onRow(obj);';const b='      const continuar = onRow(obj);\\n      if (continuar === false) throw new Error("__AWIN_STOP_STREAM__");';if(!c.includes(a))process.exit(2);c=c.replace(a,b);const x='    await lerCsvStreaming(stream, delimitador, (row) => {\\n      total += 1;\\n      const produto = normalizarProdutoLegacy(row, loja);\\n      if (!produto) return;\\n      elegiveis += 1;\\n      inserirTop(top, produto);\\n    });';const y='    try {\\n      await lerCsvStreaming(stream, delimitador, (row) => {\\n        total += 1;\\n        const produto = normalizarProdutoLegacy(row, loja);\\n        if (produto) {\\n          elegiveis += 1;\\n          inserirTop(top, produto);\\n        }\\n        if (loja.slug === "cea" && total >= 30000) return false;\\n        return true;\\n      });\\n    } catch (erro) {\\n      if (erro?.message !== "__AWIN_STOP_STREAM__") throw erro;\\n      console.log(`Amostra C&A concluida com ${'${total}'} linhas lidas.`);\\n    }';if(!c.includes(x))process.exit(3);c=c.replace(x,y);fs.writeFileSync(p,c);`,
    ]);
    if (patchLimite.resultado.exitCode !== 0) {
      throw new Error(patchLimite.stderr || "Falha ao limitar leitura do feed C&A.");
    }

    const anterior = await lerJson(sandbox, STATUS_PATH);
    if (anterior?.executando === true && await processoVarreduraAtivo(sandbox)) {
      return NextResponse.json({ sucesso: true, iniciado: false, motivo: "execucao_em_andamento", status: anterior }, { status: 202 });
    }

    await comando(sandbox, "rm", ["-f", LOG_PATH, EXIT_PATH]);

    const env = {
      AWIN_API_TOKEN: awinToken,
      AWIN_DATAFEED_API_KEY: datafeedKey,
      AWIN_PUBLISHER_ID: publisher,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      AWIN_PRODUTOS_LOJAS: "cea",
      AWIN_PRODUTOS_LIMITE_POR_LOJA: "180",
      AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      AWIN_PRODUTOS_CATALOGO_LOJAS: "cea",
    };

    await sandbox.runCommand({
      cmd: "sh",
      args: ["-lc", `node ${WRAPPER_PATH} CONFIRMAR > ${LOG_PATH} 2>&1; echo $? > ${EXIT_PATH}`],
      cwd: "/vercel",
      env,
      detached: true,
    });

    return NextResponse.json({
      sucesso: true,
      iniciado: true,
      modo: "varredura_catalogo_cea_feed_atual_amostrado",
      lojas: ["cea"],
      feeds_por_execucao: 1,
      max_linhas_feed: 30000,
      feed_preferido: "mais_recente_retornado_pela_awin",
      limite_publicacao_por_loja: 180,
      desconto_minimo_percentual_quando_verificavel: 10,
      catalogo_sem_desconto_inventado: ["cea"],
      preserva_produtos_baratos: true,
      faixas_baratas_priorizadas: ["ate9", "10a19", "20a29"],
      afiliado_obrigatorio: true,
      timeout_feed_ms: 900000,
      sandbox: SANDBOX_NAME,
      commit_script: commit,
      iniciadoEm: new Date().toISOString(),
    }, { status: 202 });
  } catch (erro) {
    console.error("[AWIN produtos] Falha no executor:", erro);
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "1") return status(request);
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
