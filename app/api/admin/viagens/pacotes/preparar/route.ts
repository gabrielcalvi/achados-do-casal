import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extrairPacoteDecolar,
  type PacoteDecolarExtraido,
} from "@/lib/viagens/decolar";
import { extrairPacoteDecolarBrowser } from "@/lib/viagens/decolarBrowser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

function precisaFallbackBrowser(erro: unknown) {
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
    let metodo: "html" | "chromium" = "html";

    try {
      dados = await extrairPacoteDecolar(link);
    } catch (erro) {
      if (!precisaFallbackBrowser(erro)) {
        throw erro;
      }

      console.log(
        "[Pacotes] Decolar bloqueou leitura direta. Tentando Chromium serverless da Function."
      );

      dados = await extrairPacoteDecolarBrowser(link);
      metodo = "chromium";
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
