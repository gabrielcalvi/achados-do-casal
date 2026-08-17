import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = {
  params: Promise<{
    id: string;
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

async function atualizarCandidato(id: string, acaoRecebida: unknown) {
  const acao = String(acaoRecebida || "").trim().toLowerCase();

  if (acao !== "aprovar" && acao !== "rejeitar") {
    return {
      ok: false as const,
      status: 400,
      erro: "Acao invalida.",
    };
  }

  const { data: candidato, error: erroBusca } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select("id,origem,status")
    .eq("id", id)
    .single();

  if (erroBusca || !candidato) {
    return {
      ok: false as const,
      status: 404,
      erro: "Candidato nao encontrado.",
    };
  }

  if (candidato.origem !== "mercado_livre_v2") {
    return {
      ok: false as const,
      status: 400,
      erro: "Este candidato nao pertence ao ML V2.",
    };
  }

  if (candidato.status === "publicado") {
    return {
      ok: false as const,
      status: 409,
      erro: "Candidato ja publicado nao pode ser alterado aqui.",
    };
  }

  const agora = new Date().toISOString();
  const atualizacao =
    acao === "aprovar"
      ? {
          status: "aprovado",
          aprovado_em: agora,
          analisado_em: agora,
          updated_at: agora,
        }
      : {
          status: "descartado",
          aprovado_em: null,
          analisado_em: agora,
          updated_at: agora,
        };

  const { data: atualizado, error: erroUpdate } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .update(atualizacao)
    .eq("id", id)
    .select("id,status,aprovado_em,analisado_em")
    .single();

  if (erroUpdate || !atualizado) {
    return {
      ok: false as const,
      status: 500,
      erro: erroUpdate?.message || "Falha atualizando candidato.",
    };
  }

  return {
    ok: true as const,
    status: 200,
    candidato: atualizado,
  };
}

export async function PATCH(
  request: Request,
  contexto: ContextoRota
) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const { id } = await contexto.params;
  const body = (await request.json().catch(() => null)) as
    | { acao?: string }
    | null;

  const resultado = await atualizarCandidato(id, body?.acao);

  if (!resultado.ok) {
    return NextResponse.json(
      { sucesso: false, erro: resultado.erro },
      { status: resultado.status }
    );
  }

  return NextResponse.json({
    sucesso: true,
    candidato: resultado.candidato,
  });
}

export async function POST(
  request: Request,
  contexto: ContextoRota
) {
  const voltar = new URL("/admin/economize/ml-v2", request.url);

  if (!(await usuarioAutenticado())) {
    voltar.searchParams.set("acao", "erro");
    voltar.searchParams.set("mensagem", "Sessao expirada. Entre novamente no admin.");
    return NextResponse.redirect(voltar, 303);
  }

  const origem = request.headers.get("origin");
  if (origem && origem !== new URL(request.url).origin) {
    voltar.searchParams.set("acao", "erro");
    voltar.searchParams.set("mensagem", "Origem da acao invalida.");
    return NextResponse.redirect(voltar, 303);
  }

  const { id } = await contexto.params;
  const form = await request.formData().catch(() => null);
  const acao = form?.get("acao");
  const resultado = await atualizarCandidato(id, acao);

  if (!resultado.ok) {
    voltar.searchParams.set("acao", "erro");
    voltar.searchParams.set("mensagem", resultado.erro);
    return NextResponse.redirect(voltar, 303);
  }

  voltar.searchParams.set(
    "acao",
    resultado.candidato.status === "aprovado" ? "aprovado" : "rejeitado"
  );
  voltar.searchParams.set("candidato", id);
  return NextResponse.redirect(voltar, 303);
}
