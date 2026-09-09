import {
  consultarPrecoProduto,
  monitorarTodosProdutos,
} from "@/lib/services/priceMonitor";
import {
  diagnosticarMercadoLivreApiPublica,
  diagnosticarMercadoLivreHttp,
  diagnosticarMercadoLivrePrecoOficial,
} from "@/lib/services/mercadoLivreHttpMonitor";
import { buscarProdutoCatalogoMercadoLivre } from "@/lib/mercadolivre/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

function extrairProductIdCatalogo(link: string) {
  try {
    const url = new URL(link);
    const match = url.pathname.match(/\/p\/(MLB\d{8,})(?:\/|$)/i);
    return match?.[1]?.toUpperCase() || null;
  } catch {
    return null;
  }
}

async function diagnosticarCatalogo(produtoId: number) {
  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,link,preco_atual")
    .eq("id", produtoId)
    .single();

  if (error || !produto) throw new Error("Produto nao encontrado.");

  const productId = extrairProductIdCatalogo(String(produto.link || ""));
  if (!productId) throw new Error("Produto nao possui product_id de catalogo na URL.");

  const catalogo = await buscarProdutoCatalogoMercadoLivre(productId);

  return {
    produto_id: produto.id,
    produto: produto.nome,
    preco_banco: Number(produto.preco_atual),
    product_id: productId,
    catalogo_id: catalogo.id,
    catalogo_nome: catalogo.name || null,
    buy_box: catalogo.buy_box_winner
      ? {
          item_id: catalogo.buy_box_winner.item_id || null,
          price: Number.isFinite(Number(catalogo.buy_box_winner.price))
            ? Number(catalogo.buy_box_winner.price)
            : null,
          currency_id: catalogo.buy_box_winner.currency_id || null,
          available_quantity: catalogo.buy_box_winner.available_quantity ?? null,
        }
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const modo = url.searchParams.get("modo");
    const modoLocal = modo === "local";

    if (idParam) {
      const id = Number(idParam);

      if (!Number.isInteger(id) || id <= 0) {
        return Response.json(
          {
            sucesso: false,
            erro: "ID de produto inválido.",
          },
          { status: 400 }
        );
      }

      if (modo === "http-ml") {
        const resultado = await diagnosticarMercadoLivreHttp(id);

        return Response.json({
          sucesso: true,
          modo: "diagnostico_http_ml",
          resultado,
        });
      }

      if (modo === "api-publica-ml") {
        const resultado = await diagnosticarMercadoLivreApiPublica(id);

        return Response.json({
          sucesso: true,
          modo: "diagnostico_api_publica_ml",
          resultado,
        });
      }

      if (modo === "preco-oficial-ml") {
        const resultado = await diagnosticarMercadoLivrePrecoOficial(id);

        return Response.json({
          sucesso: true,
          modo: "diagnostico_preco_oficial_ml",
          resultado,
        });
      }

      if (modo === "catalogo-ml") {
        const resultado = await diagnosticarCatalogo(id);

        return Response.json({
          sucesso: true,
          modo: "diagnostico_catalogo_ml",
          resultado,
        });
      }

      const resultado = await consultarPrecoProduto(id, null, modoLocal);

      return Response.json({
        sucesso: true,
        modo: modoLocal ? "produto_individual_local" : "produto_individual",
        resultado,
      });
    }

    const resultado = await monitorarTodosProdutos(modoLocal);

    return Response.json({
      sucesso: true,
      modo: modoLocal ? "monitor_local" : "monitor_remoto",
      ...resultado,
    });
  } catch (erro) {
    return Response.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}