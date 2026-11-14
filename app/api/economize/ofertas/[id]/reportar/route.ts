import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ContextoRota = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  contexto: ContextoRota,
) {
  try {
    const { id } = await contexto.params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { sucesso: false, erro: "Oferta inválida." },
        { status: 400 },
      );
    }

    const cookieNome = `cupom_reportado_${id}`;
    if (request.cookies.get(cookieNome)?.value === "1") {
      return NextResponse.json({
        sucesso: true,
        duplicado: true,
        mensagem: "Seu aviso já foi recebido.",
      });
    }

    const { data: oferta, error: erroOferta } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,status,tipo,codigo,loja_id")
      .eq("id", id)
      .maybeSingle();

    if (erroOferta) {
      console.error("Erro ao validar oferta reportada:", erroOferta);
      return NextResponse.json(
        { sucesso: false, erro: "Não foi possível registrar o aviso." },
        { status: 500 },
      );
    }

    if (!oferta || oferta.status !== "ativo" || oferta.tipo !== "cupom") {
      return NextResponse.json(
        { sucesso: false, erro: "Este cupom não está disponível." },
        { status: 404 },
      );
    }

    const { error: erroInsert } = await supabaseAdmin
      .from("economize_verificacoes")
      .insert({
        oferta_id: oferta.id,
        execucao_id: null,
        status: "erro",
        mensagem: "Relato público: o cupom não funcionou no carrinho.",
        mudancas: {
          origem: "publico_black_friday",
          acao_sugerida: "revalidar_cupom",
          codigo: oferta.codigo || null,
        },
        dados_brutos: {
          canal: "pagina_black_friday",
          recebido_em: new Date().toISOString(),
        },
      });

    if (erroInsert) {
      console.error("Erro ao registrar feedback de cupom:", erroInsert);
      return NextResponse.json(
        { sucesso: false, erro: "Não foi possível registrar o aviso." },
        { status: 500 },
      );
    }

    const resposta = NextResponse.json({
      sucesso: true,
      mensagem: "Aviso recebido. Vamos revalidar este cupom.",
    });

    resposta.cookies.set({
      name: cookieNome,
      value: "1",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return resposta;
  } catch (error) {
    console.error("Erro inesperado ao reportar cupom:", error);
    return NextResponse.json(
      { sucesso: false, erro: "Erro interno ao registrar o aviso." },
      { status: 500 },
    );
  }
}
