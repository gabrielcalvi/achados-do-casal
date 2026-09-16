import { consultarPrecoProdutoV2 } from "@/lib/services/priceMonitorV2";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const TAMANHO_LOTE = 6;
const CONCORRENCIA = 2;

export async function GET() {
  const inicio = Date.now();

  try {
    const { data, error } = await supabaseAdmin
      .from("produtos")
      .select("id,nome,monitor_falhas_consecutivas,monitor_erro_em")
      .eq("loja", "Mercado Livre")
      .eq("ativo", false)
      .not("monitor_erro", "is", null)
      .order("monitor_erro_em", { ascending: true, nullsFirst: true })
      .limit(TAMANHO_LOTE);

    if (error) {
      throw new Error(`Falha ao buscar quarentena ML: ${error.message}`);
    }

    const pendentes = data || [];
    const resultados: Array<Record<string, unknown>> = [];

    for (let i = 0; i < pendentes.length; i += CONCORRENCIA) {
      const grupo = pendentes.slice(i, i + CONCORRENCIA);

      const resultadoGrupo = await Promise.all(
        grupo.map(async (produto) => {
          try {
            const resultado = await consultarPrecoProdutoV2(produto.id);
            return {
              id: produto.id,
              nome: produto.nome,
              sucesso: true,
              preco: resultado.precoNovo,
              mudou: resultado.precoMudou,
            };
          } catch (erroProduto) {
            const agora = new Date().toISOString();
            const mensagem =
              erroProduto instanceof Error
                ? erroProduto.message
                : "Erro desconhecido";

            await supabaseAdmin
              .from("produtos")
              .update({
                monitor_erro: mensagem.slice(0, 1000),
                monitor_erro_em: agora,
                monitor_falhas_consecutivas:
                  Math.max(0, Number(produto.monitor_falhas_consecutivas) || 0) + 1,
              })
              .eq("id", produto.id);

            return {
              id: produto.id,
              nome: produto.nome,
              sucesso: false,
              erro: mensagem,
            };
          }
        })
      );

      resultados.push(...resultadoGrupo);
    }

    const recuperados = resultados.filter((item) => item.sucesso).length;
    const falhas = resultados.length - recuperados;

    return Response.json({
      sucesso: true,
      processados: resultados.length,
      recuperados,
      falhas,
      duracao_ms: Date.now() - inicio,
      resultados,
    });
  } catch (erro) {
    return Response.json(
      {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        duracao_ms: Date.now() - inicio,
      },
      { status: 500 }
    );
  }
}
