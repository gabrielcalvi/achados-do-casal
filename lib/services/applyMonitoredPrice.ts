import { supabaseAdmin } from "@/lib/supabase/admin";

export type DadosMonitorados = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
};

async function limparPendenciasAntigas(produtoId: number, agora: string) {
  const { error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .update({
      status: "aprovado",
      atualizado_em: agora,
      aprovado_em: agora,
    })
    .eq("produto_id", produtoId)
    .eq("tipo", "preco")
    .eq("status", "pendente");

  if (error) {
    console.error(
      `[MONITOR] Erro ao limpar pendencias antigas do produto ${produtoId}:`,
      error
    );
  }
}

export async function aplicarDadosMonitorados(
  produtoId: number,
  dadosAtuais: DadosMonitorados
) {
  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select("*")
    .eq("id", produtoId)
    .single();

  if (error || !produto) {
    throw new Error("Produto nao encontrado ao aplicar dados monitorados.");
  }

  const precoBanco = Number(produto.preco_atual);
  const precoNovo = Number(dadosAtuais.precoAtual);

  if (!Number.isFinite(precoNovo) || precoNovo <= 0) {
    throw new Error("A consulta retornou um preco invalido.");
  }

  const precoMudou = precoBanco !== precoNovo;
  const agora = new Date().toISOString();

  await limparPendenciasAntigas(produto.id, agora);

  const atualizacao: Record<string, unknown> = {
    ultima_verificacao: agora,
    preco_monitorado: precoNovo,
    preco_alterado: false,
  };

  if (precoMudou) {
    atualizacao.preco_atual = precoNovo;
    atualizacao.updated_at = agora;

    const { error: monitorError } = await supabaseAdmin
      .from("monitor_alteracoes")
      .insert({
        produto_id: produto.id,
        tipo: "preco",
        valor_antigo: String(precoBanco),
        valor_novo: String(precoNovo),
        status: "aprovado",
        atualizado_em: agora,
        aprovado_em: agora,
      });

    if (monitorError) {
      console.error("[MONITOR] Erro registrando alteracao:", monitorError);
    }

    if (dadosAtuais.nome) atualizacao.nome = dadosAtuais.nome;
    if (dadosAtuais.categoria) atualizacao.categoria = dadosAtuais.categoria;
    if (dadosAtuais.imagem) atualizacao.imagem = dadosAtuais.imagem;
    if (dadosAtuais.urlFinal) atualizacao.link = dadosAtuais.urlFinal;
  }

  const { error: updateError } = await supabaseAdmin
    .from("produtos")
    .update(atualizacao)
    .eq("id", produtoId);

  if (updateError) {
    throw new Error(`Erro ao atualizar o produto: ${updateError.message}`);
  }

  return {
    produtoId: produto.id,
    produto: produto.nome,
    precoBanco,
    precoNovo,
    precoMudou,
    ultimaVerificacao: agora,
    dadosAtuais,
  };
}
