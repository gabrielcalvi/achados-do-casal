import { extrairProduto } from "@/lib/extractor";
import { buscarProdutoMercadoLivre } from "@/lib/services/mercadoLivreApi";
import { supabaseAdmin } from "@/lib/supabase/admin";

type DadosAtuaisMonitor = {
  nome?: string;
  categoria?: string;
  precoAtual: string | number;
  imagem?: string;
  urlFinal?: string;
};

function ehLinkMercadoLivre(link: string) {
  const linkNormalizado =
    link.toLowerCase();

  return (
    linkNormalizado.includes(
      "mercadolivre"
    ) ||
    linkNormalizado.includes(
      "mercadolibre"
    ) ||
    linkNormalizado.includes(
      "meli.la"
    )
  );
}

function decodificarLink(link: string) {
  try {
    return decodeURIComponent(link);
  } catch {
    return link;
  }
}

function obterDestinoAfiliado(
  link: string
) {
  try {
    const url = new URL(link);

    const destinoAwin =
      url.searchParams.get("ued");

    if (destinoAwin) {
      return destinoAwin;
    }
  } catch {
    return link;
  }

  return link;
}

function normalizarItemId(
  valor: string
) {
  const resultado = valor
    .toUpperCase()
    .match(
      /(ML[A-Z])[-_]?(\d{6,})/
    );

  if (!resultado) {
    return null;
  }

  return `${resultado[1]}${resultado[2]}`;
}

function extrairItemIdMercadoLivre(
  link: string
) {
  const texto =
    decodificarLink(link);

  const parametroItem =
    texto.match(
      /[?&](?:item_id|itemId)=([^&#]+)/i
    )?.[1];

  if (parametroItem) {
    return normalizarItemId(
      parametroItem
    );
  }

  const itemComHifen =
    texto.match(
      /\/((?:ML[A-Z])-\d{6,})(?:[/?#]|$)/i
    )?.[1];

  if (itemComHifen) {
    return normalizarItemId(
      itemComHifen
    );
  }

  const linkCatalogo =
    /\/p\/ML[A-Z]\d+/i.test(
      texto
    );

  if (linkCatalogo) {
    return null;
  }

  const itemSemHifen =
    texto.match(
      /\b((?:ML[A-Z])\d{6,})\b/i
    )?.[1];

  if (itemSemHifen) {
    return normalizarItemId(
      itemSemHifen
    );
  }

  return null;
}

async function resolverLinkMercadoLivre(
  link: string
) {
  let urlAtual =
    obterDestinoAfiliado(link);

  if (
    extrairItemIdMercadoLivre(
      urlAtual
    )
  ) {
    return urlAtual;
  }

  for (
    let tentativa = 0;
    tentativa < 8;
    tentativa++
  ) {
    try {
      const resposta = await fetch(
        urlAtual,
        {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              15000
            ),
          headers: {
            Accept:
              "text/html,application/xhtml+xml,*/*",
            "Accept-Language":
              "pt-BR,pt;q=0.9",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
          },
        }
      );

      const destino =
        resposta.headers.get(
          "location"
        );

      if (resposta.body) {
        await resposta.body
          .cancel()
          .catch(
            () => undefined
          );
      }

      if (!destino) {
        return urlAtual;
      }

      urlAtual = new URL(
        destino,
        urlAtual
      ).toString();

      if (
        extrairItemIdMercadoLivre(
          urlAtual
        )
      ) {
        return urlAtual;
      }
    } catch {
      return urlAtual;
    }
  }

  return urlAtual;
}

async function obterDadosAtuais(
  produto: {
    link: string;
    categoria?: string | null;
  }
): Promise<DadosAtuaisMonitor> {
  const linkResolvido =
    await resolverLinkMercadoLivre(
      produto.link
    );

  const linkEhMercadoLivre =
    ehLinkMercadoLivre(
      produto.link
    ) ||
    ehLinkMercadoLivre(
      linkResolvido
    );

  console.log(
    "Link original:",
    produto.link
  );

  console.log(
    "Link resolvido:",
    linkResolvido
  );

  console.log(
    "É Mercado Livre:",
    linkEhMercadoLivre
  );

  if (!linkEhMercadoLivre) {
    return extrairProduto(
      produto.link
    );
  }

  const itemId =
    extrairItemIdMercadoLivre(
      linkResolvido
    ) ||
    extrairItemIdMercadoLivre(
      produto.link
    );

  if (!itemId) {
    throw new Error(
      "Não foi possível identificar o código do produto do Mercado Livre."
    );
  }

  console.log(
    `Consultando Mercado Livre pela API: ${itemId}`
  );

  const produtoApi =
    await buscarProdutoMercadoLivre(
      itemId
    );

  const categoriaAtual =
    typeof produto.categoria ===
      "string" &&
    produto.categoria.trim()
      ? produto.categoria
      : produtoApi.category_id;

  return {
    nome: produtoApi.title,
    categoria:
      categoriaAtual,
    precoAtual:
      produtoApi.price,
    imagem:
      produtoApi.thumbnail?.replace(
        /^http:/,
        "https:"
      ),
    urlFinal:
      produto.link,
  };
}

export async function consultarPrecoProduto(
  id: number
) {
  const {
    data: produto,
    error,
  } = await supabaseAdmin
    .from("produtos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !produto) {
    throw new Error(
      "Produto não encontrado."
    );
  }

  if (!produto.link) {
    throw new Error(
      "Produto sem link para monitoramento."
    );
  }

  const dadosAtuais =
    await obterDadosAtuais({
      link: produto.link,
      categoria:
        produto.categoria,
    });

  const precoBanco = Number(
    produto.preco_atual
  );

  const precoNovo = Number(
    dadosAtuais.precoAtual
  );

  console.log(
    "================================"
  );
  console.log(
    "Produto:",
    produto.nome
  );
  console.log(
    "Preço banco:",
    precoBanco
  );
  console.log(
    "Preço encontrado:",
    precoNovo
  );
  console.log(
    "Mudou?",
    precoBanco !== precoNovo
  );
  console.log(
    "================================"
  );

  if (
    !Number.isFinite(precoNovo)
  ) {
    throw new Error(
      "A consulta retornou um preço inválido."
    );
  }

  const precoMudou =
    precoBanco !== precoNovo;

  const agora =
    new Date().toISOString();

  const atualizacao: Record<
    string,
    unknown
  > = {
    ultima_verificacao: agora,
  };

  if (precoMudou) {
    atualizacao.preco_monitorado =
      precoNovo;

    atualizacao.preco_alterado =
      true;

    atualizacao.updated_at =
      agora;

    const {
      data: monitorData,
      error: monitorError,
    } = await supabaseAdmin
      .from(
        "monitor_alteracoes"
      )
      .insert({
        produto_id:
          produto.id,
        tipo: "preco",
        valor_antigo:
          String(precoBanco),
        valor_novo:
          String(precoNovo),
        status: "pendente",
      })
      .select();

    console.log(
      "Resultado monitor_alteracoes:",
      {
        monitorData,
        monitorError,
      }
    );

    if (monitorError) {
      console.error(
        "Erro monitor_alteracoes:",
        monitorError
      );
    }

    if (dadosAtuais.nome) {
      atualizacao.nome =
        dadosAtuais.nome;
    }

    if (
      dadosAtuais.categoria
    ) {
      atualizacao.categoria =
        dadosAtuais.categoria;
    }

    if (dadosAtuais.imagem) {
      atualizacao.imagem =
        dadosAtuais.imagem;
    }

    if (
      dadosAtuais.urlFinal
    ) {
      atualizacao.link =
        dadosAtuais.urlFinal;
    }
  }

  if (!precoMudou) {
    atualizacao.preco_monitorado =
      precoNovo;

    atualizacao.preco_alterado =
      false;
  }

  const {
    error: updateError,
  } = await supabaseAdmin
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
    ultimaVerificacao:
      agora,
    dadosAtuais,
  };
}

export async function monitorarTodosProdutos() {
  const {
    data: produtos,
    error,
  } = await supabaseAdmin
    .from("produtos")
    .select("id, nome")
    .eq("ativo", true)
    .order("id");

  if (error) {
    throw new Error(
      `Erro ao buscar produtos: ${error.message}`
    );
  }

  const resultados = [];

  let alterados = 0;
  let erros = 0;

  const LIMITE_CONCORRENCIA =
    4;

  const produtosAtivos =
    produtos ?? [];

  for (
    let indice = 0;
    indice <
    produtosAtivos.length;
    indice +=
      LIMITE_CONCORRENCIA
  ) {
    const lote =
      produtosAtivos.slice(
        indice,
        indice +
          LIMITE_CONCORRENCIA
      );

    const resultadosLote =
      await Promise.all(
        lote.map(
          async (produto) => {
            try {
              console.log(
                `Monitorando (${produto.id}) ${produto.nome}...`
              );

              const resultado =
                await consultarPrecoProduto(
                  produto.id
                );

              return {
                id: produto.id,
                nome: produto.nome,
                sucesso:
                  true as const,
                precoMudou:
                  resultado.precoMudou,
              };
            } catch (erro) {
              console.error(
                `Erro ao monitorar (${produto.id}) ${produto.nome}:`,
                erro
              );

              let mensagem =
                "Erro desconhecido";

              let causa:
                unknown = null;

              if (
                erro instanceof
                Error
              ) {
                mensagem =
                  erro.message;

                causa =
                  "cause" in erro
                    ? erro.cause
                    : null;
              }

              return {
                id: produto.id,
                nome: produto.nome,
                sucesso:
                  false as const,
                erro: mensagem,
                causa,
              };
            }
          }
        )
      );

    for (
      const resultado of
        resultadosLote
    ) {
      if (
        resultado.sucesso
      ) {
        if (
          resultado.precoMudou
        ) {
          alterados++;
        }
      } else {
        erros++;
      }

      resultados.push(
        resultado
      );
    }
  }

  return {
    total:
      produtos?.length ?? 0,
    alterados,
    erros,
    resultados,
  };
}