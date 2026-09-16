import { extrairProduto } from "@/lib/extractor";
import { extrairMercadoLivreWorker } from "@/lib/workers/playwrightWorker";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ProdutoBanco = {
  id: number;
  nome: string | null;
  loja: string | null;
  link: string | null;
  categoria: string | null;
  preco_atual: string | number | null;
  monitor_falhas_consecutivas: number | null;
};

type DadosMonitor = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
  fonte?: string;
};

function ehMercadoLivre(produto: Pick<ProdutoBanco, "loja" | "link">) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();
  return (
    texto.includes("mercado livre") ||
    texto.includes("mercadolivre") ||
    texto.includes("mercadolibre") ||
    texto.includes("meli.la")
  );
}

function extrairItemIdMercadoLivre(link: string): string | null {
  let texto = link;

  try {
    texto = decodeURIComponent(link);
  } catch {
    // Mantém o link original quando houver codificação incompleta.
  }

  const candidatos = [
    texto.match(/[?&#]wid=(MLB-?\d{8,})/i)?.[1],
    texto.match(/(?:^|[?&#])item_id=(MLB-?\d{8,})/i)?.[1],
    texto.match(/item_id(?::|%3A)(MLB-?\d{8,})/i)?.[1],
    texto.match(/produto\.mercadolivre\.com\.br\/(MLB-?\d{8,})/i)?.[1],
  ];

  const encontrado = candidatos.find(Boolean);
  return encontrado
    ? String(encontrado).toUpperCase().replace(/-/g, "")
    : null;
}

function linkDiretoMercadoLivre(link: string): string {
  const itemId = extrairItemIdMercadoLivre(link);
  if (!itemId) return link;

  const numero = itemId.replace(/^MLB/i, "");
  return `https://produto.mercadolivre.com.br/MLB-${numero}-_JM`;
}

async function obterDadosAtuais(produto: ProdutoBanco): Promise<DadosMonitor> {
  const link = String(produto.link || "").trim();
  if (!link) throw new Error("Produto sem link original para monitoramento.");

  if (ehMercadoLivre(produto)) {
    const linkWorker = linkDiretoMercadoLivre(link);

    try {
      const dados = await extrairMercadoLivreWorker(linkWorker);
      return {
        nome: dados.nome,
        categoria: dados.categoria,
        precoAtual: dados.precoAtual,
        imagem: dados.imagem,
        urlFinal: link,
        fonte:
          linkWorker === link
            ? "mercado_livre_playwright_worker"
            : "mercado_livre_playwright_worker_url_direta",
      };
    } catch (erroWorkerDireto) {
      const mensagemDireta =
        erroWorkerDireto instanceof Error
          ? erroWorkerDireto.message
          : String(erroWorkerDireto);

      if (linkWorker !== link) {
        try {
          const dados = await extrairMercadoLivreWorker(link);
          return {
            nome: dados.nome,
            categoria: dados.categoria,
            precoAtual: dados.precoAtual,
            imagem: dados.imagem,
            urlFinal: link,
            fonte: "mercado_livre_playwright_worker_link_original",
          };
        } catch (erroWorkerOriginal) {
          const mensagemOriginal =
            erroWorkerOriginal instanceof Error
              ? erroWorkerOriginal.message
              : String(erroWorkerOriginal);

          try {
            const dados = await extrairProduto(link);
            return {
              nome: dados.nome,
              categoria: dados.categoria,
              precoAtual: dados.precoAtual,
              imagem: dados.imagem,
              urlFinal: link,
              fonte: "mercado_livre_api_fallback",
            };
          } catch (erroApi) {
            const mensagemApi =
              erroApi instanceof Error ? erroApi.message : String(erroApi);

            throw new Error(
              `Mercado Livre falhou na URL direta (${mensagemDireta}), no link original (${mensagemOriginal}) e na API (${mensagemApi}).`
            );
          }
        }
      }

      try {
        const dados = await extrairProduto(link);
        return {
          nome: dados.nome,
          categoria: dados.categoria,
          precoAtual: dados.precoAtual,
          imagem: dados.imagem,
          urlFinal: link,
          fonte: "mercado_livre_api_fallback",
        };
      } catch (erroApi) {
        const mensagemApi =
          erroApi instanceof Error ? erroApi.message : String(erroApi);

        throw new Error(
          `Mercado Livre falhou no Worker (${mensagemDireta}) e na API (${mensagemApi}).`
        );
      }
    }
  }

  const dados = await extrairProduto(link);
  return {
    nome: dados.nome,
    categoria: dados.categoria,
    precoAtual: dados.precoAtual,
    imagem: dados.imagem,
    urlFinal: link,
    fonte: `${String(produto.loja || "loja").toLowerCase().replace(/\s+/g, "_")}_worker`,
  };
}

function validarPreco(precoBanco: number, precoNovo: number) {
  if (!Number.isFinite(precoNovo)) {
    throw new Error("A consulta retornou um preço inválido.");
  }

  if (precoNovo < 0) {
    throw new Error("A consulta retornou um preço negativo.");
  }

  if (precoBanco > 0 && precoNovo > 0) {
    const proporcao = precoNovo / precoBanco;
    if (proporcao < 0.05 || proporcao > 20) {
      throw new Error(
        `Preço suspeito bloqueado: R$ ${precoNovo.toFixed(2)} para produto publicado a R$ ${precoBanco.toFixed(2)}.`
      );
    }
  }
}

async function limparPendenciasAntigas(produtoId: number, agora: string) {
  const { error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .update({ status: "aprovado", atualizado_em: agora, aprovado_em: agora })
    .eq("produto_id", produtoId)
    .eq("tipo", "preco")
    .eq("status", "pendente");

  if (error) {
    console.error(`Erro ao limpar pendências antigas do produto ${produtoId}:`, error);
  }
}

async function limparTodasPendenciasPreco() {
  const agora = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .update({ status: "aprovado", atualizado_em: agora, aprovado_em: agora })
    .eq("tipo", "preco")
    .eq("status", "pendente");

  if (error) {
    console.error("Erro ao limpar pendências antigas do monitor:", error);
  }
}

async function registrarErro(produto: ProdutoBanco, mensagem: string) {
  const agora = new Date().toISOString();
  const falhas = Math.max(0, Number(produto.monitor_falhas_consecutivas) || 0) + 1;

  const { error } = await supabaseAdmin
    .from("produtos")
    .update({
      ultima_verificacao: agora,
      monitor_erro: mensagem.slice(0, 1000),
      monitor_erro_em: agora,
      monitor_falhas_consecutivas: falhas,
    })
    .eq("id", produto.id);

  if (error) {
    console.error(`Erro ao registrar falha do produto ${produto.id}:`, error);
  }
}

async function desativarIndisponivel(produto: ProdutoBanco, agora: string) {
  await limparPendenciasAntigas(produto.id, agora);

  const { error } = await supabaseAdmin
    .from("produtos")
    .update({
      ativo: false,
      ultima_verificacao: agora,
      preco_alterado: false,
      monitor_erro: null,
      monitor_erro_em: null,
      monitor_falhas_consecutivas: 0,
      updated_at: agora,
    })
    .eq("id", produto.id);

  if (error) {
    throw new Error(`Erro ao desativar produto indisponível: ${error.message}`);
  }
}

async function carregarProduto(id: number): Promise<ProdutoBanco> {
  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select(
      "id,nome,loja,link,categoria,preco_atual,monitor_falhas_consecutivas"
    )
    .eq("id", id)
    .single();

  if (error || !data) throw new Error("Produto não encontrado.");
  return data as ProdutoBanco;
}

export async function consultarPrecoProdutoV2(id: number) {
  const produto = await carregarProduto(id);
  const dadosAtuais = await obterDadosAtuais(produto);

  const precoBanco = Number(produto.preco_atual);
  const precoTexto = String(dadosAtuais.precoAtual ?? "").trim();

  if (!precoTexto) {
    throw new Error("A consulta não retornou preço para o produto.");
  }

  const precoNovo = Number(precoTexto);
  validarPreco(precoBanco, precoNovo);

  const agora = new Date().toISOString();

  if (precoNovo === 0) {
    await desativarIndisponivel(produto, agora);
    return {
      produtoId: produto.id,
      produto: produto.nome,
      precoBanco,
      precoNovo,
      precoMudou: false,
      indisponivel: true,
      ultimaVerificacao: agora,
      dadosAtuais,
    };
  }

  const precoMudou = Math.abs(precoBanco - precoNovo) >= 0.01;

  await limparPendenciasAntigas(produto.id, agora);

  const atualizacao: Record<string, unknown> = {
    ultima_verificacao: agora,
    preco_monitorado: precoNovo,
    preco_alterado: false,
    monitor_erro: null,
    monitor_erro_em: null,
    monitor_falhas_consecutivas: 0,
  };

  if (precoMudou) {
    atualizacao.preco_atual = precoNovo;
    atualizacao.updated_at = agora;

    if (dadosAtuais.nome) atualizacao.nome = dadosAtuais.nome;
    if (dadosAtuais.imagem) atualizacao.imagem = dadosAtuais.imagem;

    const { error: historicoError } = await supabaseAdmin
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

    if (historicoError) {
      console.error("Erro ao registrar histórico de preço:", historicoError);
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("produtos")
    .update(atualizacao)
    .eq("id", produto.id);

  if (updateError) {
    throw new Error(`Erro ao atualizar o produto: ${updateError.message}`);
  }

  return {
    produtoId: produto.id,
    produto: produto.nome,
    precoBanco,
    precoNovo,
    precoMudou,
    indisponivel: false,
    ultimaVerificacao: agora,
    dadosAtuais,
  };
}

export async function monitorarTodosProdutosV2() {
  await limparTodasPendenciasPreco();

  const { data, error } = await supabaseAdmin
    .from("produtos")
    .select(
      "id,nome,loja,link,categoria,preco_atual,monitor_falhas_consecutivas"
    )
    .eq("ativo", true)
    .order("id");

  if (error) throw new Error(`Erro ao buscar produtos: ${error.message}`);

  const produtos = (data || []) as ProdutoBanco[];
  const produtosMl = produtos.filter(ehMercadoLivre);
  const produtosOutros = produtos.filter((produto) => !ehMercadoLivre(produto));
  const resultados: Array<Record<string, unknown>> = [];
  let alterados = 0;
  let erros = 0;
  let indisponiveis = 0;

  async function processar(produto: ProdutoBanco) {
    try {
      const resultado = await consultarPrecoProdutoV2(produto.id);
      return {
        id: produto.id,
        nome: produto.nome,
        loja: produto.loja,
        sucesso: true as const,
        precoMudou: resultado.precoMudou,
        indisponivel: Boolean(resultado.indisponivel),
        fonte: resultado.dadosAtuais?.fonte || null,
      };
    } catch (erroProduto) {
      const mensagem =
        erroProduto instanceof Error ? erroProduto.message : "Erro desconhecido";
      await registrarErro(produto, mensagem);
      return {
        id: produto.id,
        nome: produto.nome,
        loja: produto.loja,
        sucesso: false as const,
        erro: mensagem,
      };
    }
  }

  // Mercado Livre roda sequencialmente para reduzir bloqueios/captcha.
  for (const produto of produtosMl) {
    resultados.push(await processar(produto));
  }

  const LIMITE_OUTRAS_LOJAS = 3;
  for (
    let indice = 0;
    indice < produtosOutros.length;
    indice += LIMITE_OUTRAS_LOJAS
  ) {
    const lote = produtosOutros.slice(indice, indice + LIMITE_OUTRAS_LOJAS);
    const resultadosLote = await Promise.all(lote.map(processar));
    resultados.push(...resultadosLote);
  }

  for (const resultado of resultados) {
    if (resultado.sucesso) {
      if (resultado.precoMudou) alterados += 1;
      if (resultado.indisponivel) indisponiveis += 1;
    } else {
      erros += 1;
    }
  }

  await limparTodasPendenciasPreco();

  return {
    total: produtos.length,
    alterados,
    indisponiveis,
    erros,
    resultados,
  };
}
