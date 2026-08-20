import { Sandbox } from "@vercel/sandbox";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANDBOX_NAME = "achados-cupons-ml-test";
const PROGRESS_PATH = "/vercel/tmp/ml-v2-comissoes-progresso.json";

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

async function rodarComando(
  sandbox: SandboxInstancia,
  cmd: string,
  args: string[]
) {
  const resultado = await sandbox.runCommand({ cmd, args });
  const stdout = (await resultado.stdout()).trim();
  return { resultado, stdout };
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const execucaoId = request.nextUrl.searchParams.get("execucao_id")?.trim() || null;
  let sandbox: SandboxInstancia | null = null;

  try {
    sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const arquivo = await rodarComando(sandbox, "cat", [PROGRESS_PATH]);

    if (arquivo.resultado.exitCode !== 0 || !arquivo.stdout) {
      return NextResponse.json({
        sucesso: true,
        disponivel: false,
        status: "preparando",
        total: 0,
        processados: 0,
      });
    }

    const progresso = JSON.parse(arquivo.stdout) as Record<string, unknown>;

    if (
      execucaoId &&
      progresso.execucao_id &&
      String(progresso.execucao_id) !== execucaoId
    ) {
      return NextResponse.json({
        sucesso: true,
        disponivel: false,
        status: "preparando",
        total: 0,
        processados: 0,
      });
    }

    return NextResponse.json({
      sucesso: true,
      disponivel: true,
      ...progresso,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Erro lendo progresso.",
      },
      { status: 500 }
    );
  }
}
