import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME =
  process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/scripts/varrer-produtos-awin-legacy.cjs";
const CONFIG_PATH = "/vercel/scripts/awin-lojas.config.cjs";
const STATUS_PATH = "/vercel/tmp/awin-produtos-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-resultado.json";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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

async function comando(
  sandbox: SandboxInstancia,
  cmd: string,
  args: string[],
  env?: Record<string, string>
) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel", env });
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();
  return { resultado, stdout, stderr };
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const leitura = await comando(sandbox, "cat", [caminho]);
  if (leitura.resultado.exitCode !== 0 || !leitura.stdout) return null;

  try {
    return JSON.parse(leitura.stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function logStatus(dados: Record<string, unknown> | null) {
  if (!dados) {
    console.info("[AWIN produtos] Nenhum status anterior encontrado no Sandbox.");
    return;
  }

  console.info("[AWIN produtos] Status anterior:", JSON.stringify(dados));
}

async function status(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const dados =
      (await lerJson(sandbox, STATUS_PATH)) ||
      (await lerJson(sandbox, RESULT_PATH)) ||
      { executando: false, mensagem: "Nenhuma varredura de produtos AWIN executada ainda." };

    logStatus(dados);
    return NextResponse.json({ sucesso: true, sandbox: SANDBOX_NAME, status: dados });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 500 }
    );
  }
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Variaveis AWIN/Data Feed/Supabase incompletas.",
        datafeed_configurado: Boolean(datafeedKey),
      },
      { status: 500 }
    );
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const preparar = await comando(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);
    if (preparar.resultado.exitCode !== 0) {
      throw new Error(preparar.stderr || "Falha preparando diretorios do Sandbox.");
    }

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos = [
      [
        `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`,
        SCRIPT_PATH,
      ],
      [
        `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`,
        CONFIG_PATH,
      ],
    ];

    for (const [url, destino] of arquivos) {
      const download = await comando(sandbox, "curl", [
        "-fsSL",
        "--max-time",
        "30",
        url,
        "-o",
        destino,
      ]);

      if (download.resultado.exitCode !== 0) {
        throw new Error(download.stderr || `Falha sincronizando ${destino} com o Sandbox.`);
      }
    }

    const anterior = await lerJson(sandbox, STATUS_PATH);
    logStatus(anterior);

    if (anterior?.executando === true) {
      console.info("[AWIN produtos] Nova execução ignorada porque a anterior ainda está rodando.");
      return NextResponse.json(
        { sucesso: true, iniciado: false, motivo: "execucao_em_andamento", status: anterior },
        { status: 202 }
      );
    }

    await sandbox.runCommand({
      cmd: "node",
      args: [SCRIPT_PATH, "CONFIRMAR"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_DATAFEED_API_KEY: datafeedKey,
        AWIN_PUBLISHER_ID: publisher,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        AWIN_PRODUTOS_LIMITE_POR_LOJA: "15",
        AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      },
      detached: true,
    });

    console.info("[AWIN produtos] Nova varredura Legacy iniciada.", {
      commit,
      publisher,
      datafeed_configurado: true,
      lojas: ["cea", "renner", "calvin-klein", "stanley"],
    });

    return NextResponse.json(
      {
        sucesso: true,
        iniciado: true,
        modo: "varredura_completa_feed_produtos_legacy",
        lojas: ["cea", "renner", "calvin-klein", "stanley"],
        limite_publicacao_por_loja: 15,
        desconto_minimo_percentual: 10,
        afiliado_obrigatorio: true,
        datafeed_configurado: true,
        commit_script: commit,
        sandbox: SANDBOX_NAME,
        iniciadoEm: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (erro) {
    console.error("[AWIN produtos] Falha no executor:", erro);
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "1") {
    return status(request);
  }

  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
