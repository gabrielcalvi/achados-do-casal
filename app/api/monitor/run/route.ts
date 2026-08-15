import {
  consultarPrecoProduto,
  monitorarTodosProdutos,
} from "@/lib/services/priceMonitor";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");

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