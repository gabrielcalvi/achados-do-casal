import { supabaseAdmin } from "@/lib/supabase/admin";

type Contexto = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: Contexto
) {
  const { id } = await params;

  const { data: alteracao, error: erroAlteracao } =
    await supabaseAdmin
      .from("monitor_alteracoes")
      .select("id, produto_id, tipo, valor_novo, status")
      .eq("id", id)
      .single();

  if (erroAlteracao || !alteracao) {
    return Response.json(
      {
        sucesso: false,
        erro: "Alteração não encontrada.",
      },
      { status: 404 }
    );
  }

  if (alteracao.status !== "pendente") {
    return Response.json(
      {
        sucesso: false,
        erro: "Essa alteração já foi revisada.",
      },
      { status: 409 }
    );
  }

  const precoNovo = Number(alteracao.valor_novo);

  if (!Number.isFinite(precoNovo)) {
    return Response.json(
      {
        sucesso: false,
        erro: "O novo preço é inválido.",
      },
      { status: 400 }
    );
  }

  const agora = new Date().toISOString();

  const { error: erroProduto } = await supabaseAdmin
    .from("produtos")
    .update({
      preco_atual: precoNovo,
      preco_monitorado: precoNovo,
      preco_alterado: false,
      updated_at: agora,
    })
    .eq("id", alteracao.produto_id);

  if (erroProduto) {
    return Response.json(
      {
        sucesso: false,
        erro: erroProduto.message,
      },
      { status: 500 }
    );
  }
const { error: erroStatus } = await supabaseAdmin
  .from("monitor_alteracoes")
  .update({
    status: "aprovado",
    atualizado_em: agora,
    aprovado_em: agora,
  })
  .eq("produto_id", alteracao.produto_id)
  .eq("tipo", alteracao.tipo)
  .eq("status", "pendente");
 
  if (erroStatus) {
    return Response.json(
      {
        sucesso: false,
        erro: erroStatus.message,
      },
      { status: 500 }
    );
  }

  return Response.json({
    sucesso: true,
  });
}