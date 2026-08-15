import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairProduto } from "@/lib/extractor";
import {
  buscarItemIdDoCatalogo,
  buscarProdutoMercadoLivre,
} from "@/lib/mercadolivre/api";
import { resolverItemId } from "@/lib/resolvers/mercadoLivre";

type DadosAtuaisMonitor = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
};

function ehMercadoLivre(produto: {
  loja?: string | null;
  link?: string | null;
}) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();

  return (
    texto.includes("mercado livre") ||
    texto.includes("mercadolivre") ||
    texto.includes("mercadolibre") ||
    texto.includes("meli.la")
  );
}

async function obterDadosMercadoLivre(produto: {
  link: string;
  categoria?: string | null;
}): Promise<DadosAtuaisMonitor> {
  const referencia = await resolverItemId(produto.link);

  if (!referencia) {
    throw new Error(
      "Não foi possível identificar o código do produto do Mercado Livre."
    );
  }

  const itemId =
    referencia.tipo === "produto"
      ? await buscarItemIdDoCatalogo(referencia.id)
      : referencia.id;

  const produtoApi = await buscarProdutoMercadoLivre(itemId);

  return {
    nome: produtoApi.title,
    categoria:
      typeof produto.categoria === "string" && produto.categoria.trim()
        ? produto.categoria
        : produtoApi.category_id,
    precoAtual: produtoApi.price,
    imagem:
      produtoApi.thumbnail?.replace(/^http:/, "https:") ||
      produtoApi.pictures?.[0]?.secure_url ||
      produtoApi.pictures?.[0]?.url,
    // O monitor nunca substitui o link original do cadastro por link da API.
    urlFinal: produto.link,
  };
}

async function obterDadosAtuais(produto: {
  loja?: string | null;
  link: string;
  categoria?: string | null;
}): Promise<DadosAtuaisMonitor> {
  if (ehMercadoLivre(produto)) {
    console.log(`[MONITOR REMOTO] Mercado Livre via API: ${produto.link}`);
    return obterDadosMercadoLivre(produto);
  }

  console.log(
    `[MONITOR REMOTO] ${produto.loja || "Loja"} via Playwright Worker: ${produto.link}`
  );

  return extrairProduto(produto.link);
}

async function limparPendenciasAntigas(
  produtoId: number,
  agora: string
) {
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
      `Erro ao limpar pendências antigas do produto ${produtoId}:`,
      error
    );
  }
}

export async function consultarPrecoProduto(id: number) {
  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !produto) {
    throw new Error("Produto não encontrado.");
  }

  const link = String(produto.link || "").trim();

  if (!link) {
    throw new Error("Produto sem link original para monitoramento.");
  }

  const dadosAtuais = await obterDadosAtuais({
    loja: produto.loja,
    link,
    categoria: produto.categoria,
  });

  const precoBanco = Number(produto.preco_atual);
  const precoNovo = Number(dadosAtuais.precoAtual);

  console.log("================================");
  console.log("Produto:", produto.nome);
  console.log("Preço banco:", precoBanco);
  console.log("Preço encontrado:", precoNovo);
  console.log("Mudou?", precoBanco !== precoNovo);
  console.log("================================");

  if (!Number.isFinite(precoNovo) || precoNovo <= 0) {
    throw new Error("A consulta retornou um preço inválido.");
  }

  const precoMudou = precoBanco !== precoNovo;
  const agora = new Date().toISOString();

  // Qualquer verificação bem-sucedida torna pendências antigas obsoletas.
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
      console.error("Erro monitor_alteracoes:", monitorError);
    }

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

  const { error: updateError } = await supabaseAdmin
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
  const { data: produtos, error } = await supabaseAdmin
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

  const LIMITE_CONCORRENCIA = 4;
  const produtosAtivos = produtos ?? [];

  for (
    let indice = 0;
    indice < produtosAtivos.length;
    indice += LIMITE_CONCORRENCIA
  ) {
    const lote = produtosAtivos.slice(
      indice,
      indice + LIMITE_CONCORRENCIA
    );

    const resultadosLote = await Promise.all(
      lote.map(async (produto) => {
        try {
          console.log(`Monitorando (${produto.id}) ${produto.nome}...`);

          const resultado = await consultarPrecoProduto(produto.id);

          return {
            id: produto.id,
            nome: produto.nome,
            sucesso: true as const,
            precoMudou: resultado.precoMudou,
          };
        } catch (erro) {
          console.error(
            `Erro ao monitorar (${produto.id}) ${produto.nome}:`,
            erro
          );

          return {
            id: produto.id,
            nome: produto.nome,
            sucesso: false as const,
            erro:
              erro instanceof Error ? erro.message : "Erro desconhecido",
          };
        }
      })
    );

    for (const resultado of resultadosLote) {
      if (resultado.sucesso) {
        if (resultado.precoMudou) {
          alterados++;
        }
      } else {
        erros++;
      }

      resultados.push(resultado);
    }
  }

  return {
    total: produtosAtivos.length,
    alterados,
    erros,
    resultados,
  };
}
