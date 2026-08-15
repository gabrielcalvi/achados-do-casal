import { Sandbox } from "@vercel/sandbox";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const MAX_ARQUIVO_BYTES = 2 * 1024 * 1024;

type StorageState = {
  cookies?: Array<{
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  origins?: Array<{
    origin?: string;
    localStorage?: Array<{
      name?: string;
      value?: string;
    }>;
  }>;
};

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

function validarStorageState(dados: StorageState) {
  if (!Array.isArray(dados.cookies) || dados.cookies.length === 0) {
    return false;
  }

  return dados.cookies.some((cookie) => {
    const dominio = String(cookie.domain || "").toLowerCase();

    return (
      dominio.includes("mercadolivre.com") ||
      dominio.includes("mercadolibre.com")
    );
  });
}

export async function POST(request: Request) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nao autorizado.",
      },
      { status: 401 }
    );
  }

  let sandbox: Awaited<ReturnType<typeof Sandbox.get>> | null = null;

  try {
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Selecione o arquivo meli-buyer-auth.json.",
        },
        { status: 400 }
      );
    }

    if (arquivo.size <= 0 || arquivo.size > MAX_ARQUIVO_BYTES) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Arquivo de sessao vazio ou maior que 2 MB.",
        },
        { status: 400 }
      );
    }

    const texto = await arquivo.text();
    let dados: StorageState;

    try {
      dados = JSON.parse(texto) as StorageState;
    } catch {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "O arquivo selecionado nao possui JSON valido.",
        },
        { status: 400 }
      );
    }

    if (!validarStorageState(dados)) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "O arquivo nao parece conter uma sessao valida do Mercado Livre.",
        },
        { status: 400 }
      );
    }

    sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await sandbox.mkDir("/vercel/tmp");
    await sandbox.writeFiles([
      {
        path: AUTH_STATE_PATH,
        content: Buffer.from(texto, "utf8"),
        mode: 0o600,
      },
    ]);

    const teste = await sandbox.runCommand({
      cmd: "test",
      args: ["-s", AUTH_STATE_PATH],
    });

    if (teste.exitCode !== 0) {
      throw new Error("A sessao nao foi gravada corretamente no Sandbox.");
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: "Sessao ML V2 atualizada no Sandbox.",
      atualizado_em: new Date().toISOString(),
    });
  } catch (erro) {
    console.error(
      "[ML V2] Falha renovando sessao no Sandbox:",
      erro instanceof Error ? erro.message : "erro inesperado"
    );

    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado ao renovar a sessao ML V2.",
      },
      { status: 500 }
    );
  } finally {
    if (sandbox) {
      await sandbox.stop().catch((erro) => {
        console.error(
          "[ML V2] Falha ao parar Sandbox apos renovar sessao:",
          erro instanceof Error ? erro.message : "erro inesperado"
        );
      });
    }
  }
}
