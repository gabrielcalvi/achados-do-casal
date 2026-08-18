import { supabaseAdmin } from "@/lib/supabase/admin";
import { consultarPrecoProduto } from "@/lib/services/priceMonitor";
import { aplicarDadosMonitorados } from "@/lib/services/applyMonitoredPrice";
import {
  extrairLoteMercadoLivre,
  type ResultadoMercadoLivreLote,
} from "@/lib/services/mercadoLivreBatchMonitor";

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 24;
const LIMITE_CONCORRENCIA = 4;

type ProdutoAutomatico = {
  id: number;
  nome: string;
  loja?: string | null;
  link?: string | null;
  ultima_verificacao?: string | null;
};

type ResultadoRodada = {
  id: number;
  nome: string;
  loja: string | null;
  sucesso: boolean;
  precoMudou?: boolean;
  precoBanco?: number;
  precoNovo?: number;
  ultimaVerificacao?: string;
  erro?: string;
};

function ehAmazon(produto: ProdutoAutomatico) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();

  return (
    texto.includes("amazon.com") ||
    texto.includes("amzn.to") ||
    texto.includes("amazon")
  );
}

function ehMercadoLivre(produto: ProdutoAutomatico) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();

  return (
    texto.includes("mercado livre") ||
    texto.includes("mercadolivre") ||
    texto.includes("mercadolibre") ||
    texto.includes("meli.la")
  );
}

function erroProduto(produto: ProdutoAutomatico, erro: unknown): ResultadoRodada {
  return {
    id: produto.id,
    nome: produto.nome,
    loja: produto.loja ?? null,
    sucesso: false,
    erro: erro instanceof Error ? erro.message : String(erro || "Erro desconhecido"),
  };
}

async function processarResultadoMl(
  produto: ProdutoAutomatico,
  resultado: ResultadoMercadoLivreLote
): Promise<ResultadoRodada> {
  if (!resultado.sucesso || !resultado.dados) {
    return erroProduto(produto, resultado.erro || "Extracao ML sem dados.");
  }

  try {
    const aplicado = await aplicarDadosMonitorados(produto.id, {
      nome: resultado.dados.nome,
      categoria: resultado.dados.categoria,
      precoAtual: resultado.dados.precoAtual,
      imagem: resultado.dados.imagem,
      // Preserva o link original cadastrado, que pode conter atribuicao de afiliado.
      urlFinal: produto.link || undefined,
    });

    return {
      id: produto.id,
      nome: produto.nome,
      loja: produto.loja ?? null,
      sucesso: true,
      precoMudou: aplicado.precoMudou,
      precoBanco: aplicado.precoBanco,
      precoNovo: aplicado.precoNovo,
      ultimaVerificacao: aplicado.ultimaVerificacao,
    };
  } catch (erro) {
    return erroProduto(produto, erro);
  }
}

async function processarLote(lote: ProdutoAutomatico[]): Promise<ResultadoRodada[]> {
  const produtosMl = lote.filter(ehMercadoLivre);
  const outros = lote.filter((produto) => !ehMercadoLivre(produto));

  const promessaMl = (async () => {
    if (produtosMl.length === 0) return [] as ResultadoRodada[];

    try {
      const resultadosMl = await extrairLoteMercadoLivre(
        produtosMl.map((produto) => ({
          id: produto.id,
          link: String(produto.link || ""),
        }))
      );

      const porId = new Map(resultadosMl.map((resultado) => [resultado.id, resultado]));

      return Promise.all(
        produtosMl.map((produto) => {
          const resultado = porId.get(produto.id);

          if (!resultado) {
            return Promise.resolve(
              erroProduto(produto, "Lote ML nao retornou este produto.")
            );
          }

          return processarResultadoMl(produto, resultado);
        })
      );
    } catch (erro) {
      console.error("[MONITOR AUTOMATICO] Falha geral no lote ML:", erro);
      return produtosMl.map((produto) => erroProduto(produto, erro));
    }
  })();

  const promessaOutros = Promise.all(
    outros.map(async (produto): Promise<ResultadoRodada> => {
      try {
        const resultado = await consultarPrecoProduto(produto.id, null, false);

        return {
          id: produto.id,
          nome: produto.nome,
          loja: produto.loja ?? null,
          sucesso: true,
          precoMudou: resultado.precoMudou,
          precoBanco: resultado.precoBanco,
          precoNovo: resultado.precoNovo,
          ultimaVerificacao: resultado.ultimaVerificacao,
        };
      } catch (erro) {
        return erroProduto(produto, erro);
      }
    })
  );

  const [resultadosMl, resultadosOutros] = await Promise.all([
    promessaMl,
    promessaOutros,
  ]);

  const porId = new Map(
    [...resultadosMl, ...resultadosOutros].map((resultado) => [resultado.id, resultado])
  );

  return lote.map(
    (produto) => porId.get(produto.id) || erroProduto(produto, "Resultado ausente.")
  );
}

export async function monitorarProdutosAutomaticamente(
  limite = LIMITE_PADRAO
) {
  const limiteSeguro = Math.max(
    1,
    Math.min(
      LIMITE_MAXIMO,
      Number.isFinite(limite) ? Math.trunc(limite) : LIMITE_PADRAO
    )
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
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Erro ao montar fila automatica: ${error.message}`);
  }

  const produtosComLink = (produtos ?? []) as ProdutoAutomatico[];
  const produtosAmazon = produtosComLink.filter(ehAmazon);
  const fila = produtosComLink
    .filter((produto) => !ehAmazon(produto))
    .slice(0, limiteSeguro);

  const resultados: ResultadoRodada[] = [];
  let alterados = 0;
  let erros = 0;

  for (let indice = 0; indice < fila.length; indice += LIMITE_CONCORRENCIA) {
    const lote = fila.slice(indice, indice + LIMITE_CONCORRENCIA);

    console.log(
      `[MONITOR AUTOMATICO] Lote ${Math.floor(indice / LIMITE_CONCORRENCIA) + 1}: ${lote
        .map((produto) => produto.id)
        .join(", ")}`
    );

    const resultadosLote = await processarLote(lote);

    for (const resultado of resultadosLote) {
      if (resultado.sucesso) {
        if (resultado.precoMudou) alterados += 1;
      } else {
        erros += 1;
      }

      resultados.push(resultado);
    }
  }

  return {
    modo: "rodada_automatica",
    limite: limiteSeguro,
    total: fila.length,
    alterados,
    erros,
    concorrencia: LIMITE_CONCORRENCIA,
    ignoradosAmazon: produtosAmazon.length,
    resultados,
  };
}
