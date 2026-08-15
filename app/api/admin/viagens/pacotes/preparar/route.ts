import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";
import {
  extrairPacoteDecolar,
  type PacoteDecolarExtraido,
} from "@/lib/viagens/decolar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_BASE = "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/tmp/extrair-pacote-decolar.cjs";
const TEAM_ID = "team_0CKxtwEDL8irqdErEAY4cLLm";
const PROJECT_ID = "prj_coa8aSyGbro5Phn3BYONZ3ui3kq3";

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

function precisaFallbackSandbox(erro: unknown) {
  const mensagem =
    erro instanceof Error
      ? erro.message.toLowerCase()
      : String(erro || "").toLowerCase();

  return (
    mensagem.includes("http 403") ||
    mensagem.includes("forbidden") ||
    mensagem.includes("access denied")
  );
}

async function obterSandbox() {
  const token = await getVercelOidcToken({
    team: TEAM_ID,
    project: PROJECT_ID,
  });

  return Sandbox.get({
    name: SANDBOX_BASE,
    token,
    teamId: TEAM_ID,
    projectId: PROJECT_ID,
  });
}

async function comando(
  sandbox: SandboxInstancia,
  cmd: string,
  args: string[],
  cwd?: string
) {
  const resultado = await sandbox.runCommand({
    cmd,
    args,
    ...(cwd ? { cwd } : {}),
  });

  return {
    exitCode: resultado.exitCode,
    stdout: (await resultado.stdout()).trim(),
    stderr: (await resultado.stderr()).trim(),
  };
}

async function extrairViaSandbox(
  link: string
): Promise<PacoteDecolarExtraido> {
  const sandbox = await obterSandbox();

  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";

  const scriptUrl =
    `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(
      commit
    )}/scripts/extrair-pacote-decolar.cjs`;

  const preparar = await comando(
    sandbox,
    "mkdir",
    ["-p", "/vercel/tmp"]
  );

  if (preparar.exitCode !== 0) {
    throw new Error(
      preparar.stderr || "Falha preparando Sandbox da Decolar."
    );
  }

  const baixar = await comando(
    sandbox,
    "curl",
    [
      "-fsSL",
      "--max-time",
      "30",
      scriptUrl,
      "-o",
      SCRIPT_PATH,
    ]
  );

  if (baixar.exitCode !== 0) {
    throw new Error(
      baixar.stderr || "Falha sincronizando extrator Decolar no Sandbox."
    );
  }

  const execucao = await comando(
    sandbox,
    "xvfb-run",
    ["-a", "node", SCRIPT_PATH, link],
    "/vercel"
  );

  if (execucao.exitCode !== 0) {
    throw new Error(
      execucao.stderr ||
        execucao.stdout ||
        "O navegador da Decolar nao conseguiu preparar o pacote."
    );
  }

  if (!execucao.stdout) {
    throw new Error("O navegador terminou sem devolver os dados do pacote.");
  }

  try {
    return JSON.parse(execucao.stdout) as PacoteDecolarExtraido;
  } catch {
    throw new Error(
      "O navegador da Decolar devolveu um resultado invalido."
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const link = String(body?.link || "").trim();

    if (!link) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe o link original da Decolar." },
        { status: 400 }
      );
    }

    let url: URL;

    try {
      url = new URL(link);
    } catch {
      return NextResponse.json(
        { sucesso: false, erro: "O link informado nao e valido." },
        { status: 400 }
      );
    }

    if (!url.hostname.toLowerCase().includes("decolar.com")) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Por enquanto o preparo automatico aceita links da Decolar.",
        },
        { status: 400 }
      );
    }

    let dados: PacoteDecolarExtraido;
    let metodo: "html" | "sandbox" = "html";

    try {
      dados = await extrairPacoteDecolar(link);
    } catch (erro) {
      if (!precisaFallbackSandbox(erro)) {
        throw erro;
      }

      console.log(
        "[Pacotes] Decolar bloqueou leitura direta. Tentando navegador autenticado do Sandbox."
      );

      dados = await extrairViaSandbox(link);
      metodo = "sandbox";
    }

    return NextResponse.json({
      sucesso: true,
      metodo,
      dados,
    });
  } catch (erro) {
    console.error("[Pacotes] Falha ao preparar link Decolar:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado ao preparar o pacote.",
      },
      { status: 500 }
    );
  }
}
