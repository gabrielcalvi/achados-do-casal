import { monitorarTodosProdutos } from "@/lib/services/priceMonitor";

export async function GET() {
  try {
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
