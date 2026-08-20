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
  fonte?: string;
};

function ehMercadoLivre(produto: { loja?: string | null; link?: string | null }) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();
  return (
    texto.includes("mercado livre") ||
    texto.includes("mercadolivre") ||
    texto.includes("mercadolibre") ||
    texto.includes("meli.la")
  );
}

function extrairItemIdMercadoLivre(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid") || "",
      url.searchParams.get("item_id") || "",
      url.searchParams.get("pdp_filters") || "",
      url.pathname,
      link,
    ];

    for (const candidato of candidatos) {
      const match = candidato.match(/MLB[-:]?(\d{8,})/i);
      if (match?.[1]) return `MLB${match[1]}`;
    }
  } catch {
    const match = link.match(/MLB[-:]?(\d{8,})/i);
    if (match?.[1]) return `MLB${match[1]}`;
  }

  return null;
}

async function resolverItemIdMercadoLivre(link: string) {
  const direto = extrairItemIdMercadoLivre(link);
  if (direto) return direto;

  if (!link.toLowerCase().includes("meli.la")) return null;

  try {
    const resposta = await fetch(link, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const resolvido = extrairItemIdMercadoLivre(resposta.url);
    if (resolvido) return resolvido;
  } catch {
    // Tenta GET abaixo.
  }

  try {
    const resposta = await fetch(link, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    return extrairItemIdMercadoLivre(resposta.url);
  } catch {
    return null;
  }
}

async function extrairMercadoLivreApi(
  link: string,
  categoriaAtual?: string | null
): Promise<DadosAtuaisMonitor> {
  const itemId = await resolverItemIdMercadoLivre(link);

  if (!itemId) {
    throw new Error("Não foi possível identificar o item do Mercado Livre pela URL.");
  }

  const resposta = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });

  const texto = await resposta.text();
  let json: Record<string, any> | null = null;

  try {
    json = JSON.parse(texto) as Record<string, any>;
  } catch {
    json = null;
  }

  if (!resposta.ok || !json) {
    const detalhe = json?.message || json?.error || texto.slice(0, 160);
    throw new Error(
      `API pública do Mercado Livre respondeu ${resposta.status}${detalhe ? `: ${detalhe}` : ""}`
    );
  }

  const preco = Number(json.price);
  if (!Number.isFinite(preco) || preco <= 0) {
    throw new Error("API pública do Mercado Livre não retornou preço válido.");
  }

  const imagem =
    String(json.secure_thumbnail || json.thumbnail || "").trim() ||
    (Array.isArray(json.pictures)
      ? String(json.pictures[0]?.secure_url || json.pictures[0]?.url || "").trim()
      : "");

  return {
    nome: String(json.title || "").trim() || undefined,
    categoria: categoriaAtual || undefined,
    precoAtual: preco,
    imagem: imagem || undefined,
    urlFinal: link,
    fonte: "mercado_livre_api_publica",
  };
}

async function obterDadosAtuais(
  produto: { loja?: string | null; link: string; categoria?: string | null },
  sessaoMl?: SessaoMonitorMercadoLivre | null,
  modoLocal = false
): Promise<DadosAtuaisMonitor> {
  if (modoLocal) return extrairProduto(produto.link);

  if (ehMercadoLivre(produto)) {
    try {
      return await extrairMercadoLivreApi(produto.link, produto.categoria);
    } catch (erroApi) {
      console.warn(
        "[MONITOR ML] API pública falhou; usando Sandbox como fallback:",
        erroApi instanceof Error ? erroApi.message : erroApi
      );

      if (!sessaoMl) {
        throw new Error(
          `API pública do Mercado Livre falhou e a sessão remota não foi inicializada: ${
            erroApi instanceof Error ? erroApi.message : String(erroApi)
          }`
        );
      }

      const dados = await sessaoMl.extrair(produto.link);
      return {
        nome: dados.nome,
        categoria: produto.categoria || dados.categoria,
        precoAtual: dados.precoAtual,
        imagem: dados.imagem,
        urlFinal: produto.link,
        fonte: "mercado_livre_sandbox_fallback",
      };
    }
  }

  return extrairProduto(produto.link);
}

async function limparPendenciasAntigas(produtoId: number, agora: string) {
  const { error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .update({ status: "aprovado", atualizado_em: agora, aprovado_em: agora })
    .eq("produto_id", produtoId)
    .eq("tipo", "preco")
    .eq("status", "pendente");

  if (error) console.error(`Erro ao limpar pendências antigas do produto ${produtoId}:`, error);
}

async function limparTodasPendenciasPreco() {
  const agora = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .update({ status: "aprovado", atualizado_em: agora, aprovado_em: agora })
    .eq("tipo", "preco")
    .eq("status", "pendente");

  if (error) console.error("Erro ao autoaprovar pendências antigas do monitor:", error);
}

async function registrarErroMonitor(
  produto: { id: number; monitor_falhas_consecutivas?: number | null },
  mensagem: string
) {
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

  if (error) console.error(`Erro ao registrar falha do monitor no produto ${produto.id}:`, error);
}

async function desativarProdutoIndisponivel(produtoId: number, agora: string) {
  await limparPendenciasAntigas(produtoId, agora);

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
    .eq("id", produtoId);

  if (error) throw new Error(`Erro ao desativar produto indisponível: ${error.message}`);
}

function validarPrecoSuspeito(precoBanco: number, precoNovo: number) {
  if (!Number.isFinite(precoNovo)) throw new Error("A consulta retornou um preço inválido.");
  if (!Number.isFinite(precoBanco) || precoBanco <= 0 || precoNovo <= 0) return;

  const proporcao = precoNovo / precoBanco;
  if (proporcao < 0.05 || proporcao > 20) {
    throw new Error(`Preço suspeito bloqueado: R$ ${precoNovo.toFixed(2)} para produto publicado a R$ ${precoBanco.toFixed(2)}.`);
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

  if (error || !produto) throw new Error("Produto não encontrado.");

  const link = String(produto.link || "").trim();
  if (!link) throw new Error("Produto sem link original para monitoramento.");

  let sessaoCriadaAqui: SessaoMonitorMercadoLivre | null = null;
  let sessaoEfetiva = sessaoMl ?? null;

  if (!modoLocal && ehMercadoLivre(produto) && !sessaoEfetiva) {
    sessaoCriadaAqui = await criarSessaoMonitorMercadoLivre();
    sessaoEfetiva = sessaoCriadaAqui;
  }

  try {
    const dadosAtuais = await obterDadosAtuais(
      { loja: produto.loja, link, categoria: produto.categoria },
      sessaoEfetiva,
      modoLocal
    );

    const precoBanco = Number(produto.preco_atual);
    const precoNovo = Number(dadosAtuais.precoAtual);
    const agora = new Date().toISOString();

    if (Number.isFinite(precoNovo) && precoNovo === 0) {
      await desativarProdutoIndisponivel(produto.id, agora);
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

    validarPrecoSuspeito(precoBanco, precoNovo);
    if (precoNovo <= 0) throw new Error("A consulta retornou um preço inválido.");

    const precoMudou = precoBanco !== precoNovo;
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

      if (monitorError) console.error("Erro monitor_alteracoes:", monitorError);

      if (dadosAtuais.nome) atualizacao.nome = dadosAtuais.nome;
      if (dadosAtuais.imagem) atualizacao.imagem = dadosAtuais.imagem;
      if (dadosAtuais.urlFinal) atualizacao.link = dadosAtuais.urlFinal;
    }

    const { error: updateError } = await supabaseAdmin
      .from("produtos")
      .update(atualizacao)
      .eq("id", id);

    if (updateError) throw new Error(`Erro ao atualizar o produto: ${updateError.message}`);

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
  } finally {
    if (sessaoCriadaAqui) await sessaoCriadaAqui.fechar();
  }
}

export async function monitorarTodosProdutos(modoLocal = false) {
  await limparTodasPendenciasPreco();

  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id, nome, loja, link, monitor_falhas_consecutivas")
    .eq("ativo", true)
    .order("id");

  if (error) throw new Error(`Erro ao buscar produtos: ${error.message}`);

  const resultados = [];
  let alterados = 0;
  let erros = 0;
  let indisponiveis = 0;

  const produtosAtivos = produtos ?? [];
  const possuiMercadoLivre = produtosAtivos.some((produto) => ehMercadoLivre(produto));
  let sessaoMl: SessaoMonitorMercadoLivre | null = null;

  try {
    if (!modoLocal && possuiMercadoLivre) {
      sessaoMl = await criarSessaoMonitorMercadoLivre();
    }

    const LIMITE_CONCORRENCIA = 4;

    for (let indice = 0; indice < produtosAtivos.length; indice += LIMITE_CONCORRENCIA) {
      const lote = produtosAtivos.slice(indice, indice + LIMITE_CONCORRENCIA);

      const resultadosLote = await Promise.all(
        lote.map(async (produto) => {
          try {
            const resultado = await consultarPrecoProduto(produto.id, sessaoMl, modoLocal);
            return {
              id: produto.id,
              nome: produto.nome,
              sucesso: true as const,
              precoMudou: resultado.precoMudou,
              indisponivel: Boolean(resultado.indisponivel),
            };
          } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido";
            await registrarErroMonitor(produto, mensagem);
            return {
              id: produto.id,
              nome: produto.nome,
              sucesso: false as const,
              erro: mensagem,
            };
          }
        })
      );

      for (const resultado of resultadosLote) {
        if (resultado.sucesso) {
          if (resultado.precoMudou) alterados++;
          if (resultado.indisponivel) indisponiveis++;
        } else {
          erros++;
        }
        resultados.push(resultado);
      }
    }
  } finally {
    if (sessaoMl) await sessaoMl.fechar();
  }

  await limparTodasPendenciasPreco();

  return {
    total: produtosAtivos.length,
    alterados,
    indisponiveis,
    erros,
    resultados,
  };
}
