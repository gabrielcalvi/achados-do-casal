import { supabase } from "@/lib/supabase";
import { extrairProduto } from "@/lib/extractor";

export async function consultarPrecoProduto(id: number) {
  const { data: produto, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !produto) {
    throw new Error("Produto não encontrado.");
  }

  if (!produto.link) {
    throw new Error("Produto sem link para monitoramento.");
  }

  const dadosAtuais = await extrairProduto(produto.link);

  const precoBanco = Number(produto.preco_atual);
  const precoNovo = Number(dadosAtuais.precoAtual);

  if (!Number.isFinite(precoNovo)) {
    throw new Error("O Worker retornou um preço inválido.");
  }

  const precoMudou = precoBanco !== precoNovo;
  const agora = new Date().toISOString();

  const atualizacao: Record<string, unknown> = {
    ultima_verificacao: agora,
  };

  if (precoMudou) {
    atualizacao.preco_antigo = precoBanco;
    atualizacao.preco_atual = precoNovo;
    atualizacao.updated_at = agora;

    if (dadosAtuais.nome) {
      atualizacao.nome = dadosAtuais.nome;
    }

    if (dadosAtuais.categoria) {
      atualizacao.categoria = dadosAtuais.categoria;
    }

    if (dadosAtuais.imagem) {
      atualizacao.imagem = dadosAtuais.imagem;
    }

    if (dadosAtuais.urlFinal) {
      atualizacao.link = dadosAtuais.urlFinal;
    }
  }

  const { error: updateError } = await supabase
    .from("produtos")
    .update(atualizacao)
    .eq("id", id);

  if (updateError) {
    throw new Error(
      `Erro ao atualizar o produto: ${updateError.message}`
    );
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
export async function monitorarTodosProdutos() {
  const { data: produtos, error } = await supabase
    .from("produtos")
    .select("id, nome")
    .eq("ativo", true)
    .order("id");

  if (error) {
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }

  const resultados = [];
  let alterados = 0;
  let erros = 0;

  for (const produto of produtos ?? []) {
    try {
      console.log(
        `Monitorando (${produto.id}) ${produto.nome}...`
      );

      const resultado = await consultarPrecoProduto(produto.id);

      if (resultado.precoMudou) {
        alterados++;
      }

      resultados.push({
        id: produto.id,
        nome: produto.nome,
        sucesso: true,
        precoMudou: resultado.precoMudou,
      });
   } catch (erro) {
  erros++;

  console.error(
    `Erro ao monitorar (${produto.id}) ${produto.nome}:`,
    erro
  );

  let mensagem = "Erro desconhecido";
  let causa: unknown = null;

  if (erro instanceof Error) {
    mensagem = erro.message;

    causa =
      "cause" in erro
        ? erro.cause
        : null;
  }

  resultados.push({
    id: produto.id,
    nome: produto.nome,
    sucesso: false,
    erro: mensagem,
    causa,
  });
}
}
  return {
    total: produtos?.length ?? 0,
    alterados,
    erros,
    resultados,
  };
}