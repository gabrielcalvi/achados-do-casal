import {
  consultarPrecoProduto,
  monitorarTodosProdutos,
} from "@/lib/services/priceMonitor";
import {
  diagnosticarMercadoLivreApiPublica,
  diagnosticarMercadoLivreHttp,
  diagnosticarMercadoLivrePrecoOficial,
} from "@/lib/services/mercadoLivreHttpMonitor";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const modo = url.searchParams.get("modo");

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

      const resultado = await consultarPrecoProduto(id);

      return Response.json({
        sucesso: true,
        modo: "produto_individual",
        resultado,
      });
    }

    const resultado = await monitorarTodosProdutos();

    return Response.json({
      sucesso: true,
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