import { supabaseAdmin } from "@/lib/supabase/admin";
import { consultarPrecoProduto } from "@/lib/services/priceMonitor";
import {
  criarSessaoMonitorMercadoLivre,
  type SessaoMonitorMercadoLivre,
} from "@/lib/services/mercadoLivreSandboxMonitor";

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

function ehAmazon(produto: ProdutoAutomatico) {
  const texto = `${produto.loja || ""} ${produto.link || ""}`.toLowerCase();

  return texto.includes("amazon.com") || texto.includes("amzn.to") || texto.includes("amazon");
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
    throw new Error(`Erro ao montar fila automática: ${error.message}`);
  }

  const produtosComLink = (produtos ?? []) as ProdutoAutomatico[];
  const produtosAmazon = produtosComLink.filter(ehAmazon);
  const fila = produtosComLink.filter((produto) => !ehAmazon(produto)).slice(0, limiteSeguro);

  const resultados: Array<Record<string, unknown>> = [];
  let alterados = 0;
  let erros = 0;
  let sessaoMl: SessaoMonitorMercadoLivre | null = null;

  try {
    if (fila.some(ehMercadoLivre)) {
      console.log("[MONITOR AUTOMATICO] Inicializando Sandbox autenticado do Mercado Livre...");
      sessaoMl = await criarSessaoMonitorMercadoLivre();
    }

    for (let indice = 0; indice < fila.length; indice += LIMITE_CONCORRENCIA) {
      const lote = fila.slice(indice, indice + LIMITE_CONCORRENCIA);

      console.log(
        `[MONITOR AUTOMATICO] Lote ${Math.floor(indice / LIMITE_CONCORRENCIA) + 1}: ${lote
          .map((produto) => produto.id)
          .join(", ")}`
      );

      const resultadosLote = await Promise.all(
        lote.map(async (produto) => {
          try {
            const resultado = await consultarPrecoProduto(
              produto.id,
              sessaoMl,
              false
            );

            return {
              id: produto.id,
              nome: produto.nome,
              loja: produto.loja ?? null,
              sucesso: true as const,
              precoMudou: resultado.precoMudou,
              precoBanco: resultado.precoBanco,
              precoNovo: resultado.precoNovo,
              ultimaVerificacao: resultado.ultimaVerificacao,
            };
          } catch (erroProduto) {
            console.error(
              `[MONITOR AUTOMATICO] Erro no produto ${produto.id}:`,
              erroProduto
            );

            return {
              id: produto.id,
              nome: produto.nome,
              loja: produto.loja ?? null,
              sucesso: false as const,
              erro:
                erroProduto instanceof Error
                  ? erroProduto.message
                  : "Erro desconhecido",
            };
          }
        })
      );

      for (const resultado of resultadosLote) {
        if (resultado.sucesso) {
          if (resultado.precoMudou) alterados += 1;
        } else {
          erros += 1;
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
