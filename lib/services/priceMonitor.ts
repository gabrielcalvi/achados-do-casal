import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairProduto } from "@/lib/extractor";
import {
  criarSessaoMonitorMercadoLivre,
  type SessaoMonitorMercadoLivre,
} from "@/lib/services/mercadoLivreSandboxMonitor";

type DadosAtuaisMonitor = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
};

type ProdutoFilaMonitor = {
  id: number;
  nome: string;
  loja?: string | null;
  link?: string | null;
};

const LIMITE_CONCORRENCIA = 4;
const LIMITE_RODADA_AUTOMATICA = 12;

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

function possuiLinkMonitoravel(produto: ProdutoFilaMonitor) {
  return typeof produto.link === "string" && produto.link.trim().length > 0;
}

async function obterDadosAtuais(
  produto: {
    loja?: string | null;
    link: string;
    categoria?: string | null;
  },
  sessaoMl?: SessaoMonitorMercadoLivre | null,
  modoLocal = false
): Promise<DadosAtuaisMonitor> {
  if (modoLocal) {
    console.log(
      `[MONITOR LOCAL] ${produto.loja || "Loja"} via Playwright local: ${produto.link}`
    );

    return extrairProduto(produto.link);
  }

  if (ehMercadoLivre(produto)) {
    if (!sessaoMl) {
      throw new Error("Sessão remota do Mercado Livre não foi inicializada.");
    }

    console.log(`[MONITOR REMOTO] Mercado Livre via Sandbox autenticado: ${produto.link}`);

    const dados = await sessaoMl.extrair(produto.link);

    return {
      nome: dados.nome,
      categoria:
        typeof produto.categoria === "string" && produto.categoria.trim()
          ? produto.categoria
          : dados.categoria,
      precoAtual: dados.precoAtual,
      imagem: dados.imagem,
      urlFinal: produto.link,
    };
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

export async function consultarPrecoProduto(
  id: number,
  sessaoMl?: SessaoMonitorMercadoLivre | null,
  modoLocal = false
) {
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

  let sessaoCriadaAqui: SessaoMonitorMercadoLivre | null = null;
  let sessaoEfetiva = sessaoMl ?? null;

  if (!modoLocal && ehMercadoLivre(produto) && !sessaoEfetiva) {
    sessaoCriadaAqui = await criarSessaoMonitorMercadoLivre();
    sessaoEfetiva = sessaoCriadaAqui;
  }

  try {
    const dadosAtuais = await obterDadosAtuais(
      {
        loja: produto.loja,
        link,
        categoria: produto.categoria,
      },
      sessaoEfetiva,
      modoLocal
    );

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
  } finally {
    if (sessaoCriadaAqui) {
      await sessaoCriadaAqui.fechar();
    }
  }
}

async function executarFilaMonitor(
  produtos: ProdutoFilaMonitor[],
  modoLocal = false
) {
  const produtosMonitoraveis = produtos.filter(possuiLinkMonitoravel);
  const ignoradosSemLink = produtos.length - produtosMonitoraveis.length;
  const resultados: Array<Record<string, unknown>> = [];
  let alterados = 0;
  let erros = 0;

  const possuiMercadoLivre = produtosMonitoraveis.some((produto) =>
    ehMercadoLivre(produto)
  );

  let sessaoMl: SessaoMonitorMercadoLivre | null = null;

  try {
    if (!modoLocal && possuiMercadoLivre) {
      console.log("[MONITOR REMOTO] Inicializando Sandbox autenticado do Mercado Livre...");
      sessaoMl = await criarSessaoMonitorMercadoLivre();
    }

    if (modoLocal) {
      console.log("[MONITOR LOCAL] Rodada local iniciada. Preços válidos serão aplicados automaticamente.");
    }

    for (
      let indice = 0;
      indice < produtosMonitoraveis.length;
      indice += LIMITE_CONCORRENCIA
    ) {
      const lote = produtosMonitoraveis.slice(
        indice,
        indice + LIMITE_CONCORRENCIA
      );

      const resultadosLote = await Promise.all(
        lote.map(async (produto) => {
          try {
            console.log(`Monitorando (${produto.id}) ${produto.nome}...`);

            const resultado = await consultarPrecoProduto(
              produto.id,
              sessaoMl,
              modoLocal
            );

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
  } finally {
    if (sessaoMl) {
      await sessaoMl.fechar();
    }
  }

  return {
    total: produtosMonitoraveis.length,
    ignoradosSemLink,
    alterados,
    erros,
    concorrencia: LIMITE_CONCORRENCIA,
    resultados,
  };
}

export async function monitorarTodosProdutos(modoLocal = false) {
  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id, nome, loja, link")
    .eq("ativo", true)
    .order("id");

  if (error) {
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }

  return executarFilaMonitor(produtos ?? [], modoLocal);
}

export async function monitorarProdutosMaisAntigos(
  limite = LIMITE_RODADA_AUTOMATICA
) {
  const limiteSeguro = Math.max(
    1,
    Math.min(24, Number.isFinite(limite) ? Math.trunc(limite) : LIMITE_RODADA_AUTOMATICA)
  );

  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id, nome, loja, link, ultima_verificacao")
    .eq("ativo", true)
    .not("link", "is", null)
    .neq("link", "")
    .order("ultima_verificacao", {
      ascending: true,
      nullsFirst: true,
    })
    .order("id", { ascending: true })
    .limit(limiteSeguro);

  if (error) {
    throw new Error(`Erro ao montar fila automática: ${error.message}`);
  }

  const resultado = await executarFilaMonitor(produtos ?? [], false);

  return {
    modo: "rodada_automatica",
    limite: limiteSeguro,
    ...resultado,
  };
}
