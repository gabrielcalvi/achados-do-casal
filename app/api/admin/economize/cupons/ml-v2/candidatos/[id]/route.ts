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

  const acao = String(body?.acao || "").trim().toLowerCase();

  if (acao !== "aprovar" && acao !== "rejeitar") {
    return NextResponse.json(
      { sucesso: false, erro: "Acao invalida." },
      { status: 400 }
    );
  }

  const { data: candidato, error: erroBusca } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select("id,origem,status")
    .eq("id", id)
    .single();

  if (erroBusca || !candidato) {
    return NextResponse.json(
      { sucesso: false, erro: "Candidato nao encontrado." },
      { status: 404 }
    );
  }

  if (candidato.origem !== "mercado_livre_v2") {
    return NextResponse.json(
      { sucesso: false, erro: "Este candidato nao pertence ao ML V2." },
      { status: 400 }
    );
  }

  if (candidato.status === "publicado") {
    return NextResponse.json(
      { sucesso: false, erro: "Candidato ja publicado nao pode ser alterado aqui." },
      { status: 409 }
    );
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
    return NextResponse.json(
      {
        sucesso: false,
        erro: erroUpdate?.message || "Falha atualizando candidato.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    candidato: atualizado,
  });
}
