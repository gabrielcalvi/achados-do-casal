import {
  consultarPrecoProduto,
  monitorarTodosProdutos,
} from "@/lib/services/priceMonitor";
import {
  diagnosticarMercadoLivreApiPublica,
  diagnosticarMercadoLivreHttp,
  diagnosticarMercadoLivrePrecoOficial,
} from "@/lib/services/mercadoLivreHttpMonitor";
import {
  buscarItensDoCatalogoMercadoLivre,
  buscarProdutoCatalogoMercadoLivre,
} from "@/lib/mercadolivre/api";
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

function extrairItemIdDoLink(link: string) {
  try {
    const url = new URL(link);
    const candidatos = [
      url.searchParams.get("wid") || "",
      url.searchParams.get("item_id") || "",
      url.searchParams.get("pdp_filters") || "",
      decodeURIComponent(url.hash || ""),
      decodeURIComponent(link),
    ];

    for (const candidato of candidatos) {
      const match = candidato.match(/MLB-?(\d{8,})/i);
      if (match?.[1]) return `MLB${match[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

async function diagnosticarCatalogo(produtoId: number) {
  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,link,preco_atual")
    .eq("id", produtoId)
    .single();

  if (error || !produto) throw new Error("Produto nao encontrado.");

  const link = String(produto.link || "");
  const productId = extrairProductIdCatalogo(link);
  if (!productId) throw new Error("Produto nao possui product_id de catalogo na URL.");

  const [catalogo, itens] = await Promise.all([
    buscarProdutoCatalogoMercadoLivre(productId),
    buscarItensDoCatalogoMercadoLivre(productId),
  ]);

  const itemOriginal = extrairItemIdDoLink(link);
  const resultados = Array.isArray(itens.results) ? itens.results : [];
  const encontradoOriginal = itemOriginal
    ? resultados.find((item) => String(item.item_id || "").toUpperCase() === itemOriginal)
    : null;

  return {
    produto_id: produto.id,
    produto: produto.nome,
    preco_banco: Number(produto.preco_atual),
    product_id: productId,
    item_original: itemOriginal,
    catalogo_id: catalogo.id,
    catalogo_status: catalogo.status || null,
    catalogo_nome: catalogo.name || null,
    parent_id: catalogo.parent_id || null,
    children_ids: catalogo.children_ids || [],
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
    itens_total: Number(itens.paging?.total || resultados.length),
    item_original_na_lista: encontradoOriginal
      ? {
          item_id: encontradoOriginal.item_id,
          price: Number.isFinite(Number(encontradoOriginal.price))
            ? Number(encontradoOriginal.price)
            : null,
          currency_id: encontradoOriginal.currency_id || null,
          available_quantity: encontradoOriginal.available_quantity ?? null,
        }
      : null,
    amostra_itens: resultados.slice(0, 5).map((item) => ({
      item_id: item.item_id,
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      currency_id: item.currency_id || null,
      available_quantity: item.available_quantity ?? null,
    })),
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