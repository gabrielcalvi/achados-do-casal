import { createClient } from "@/lib/supabase/server";
import { atualizarMercadoLivreManuaisViaHttp } from "@/lib/services/mercadoLivreHttpMonitor";
import { avaliarAlertasDePreco } from "@/lib/services/priceAlerts";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const resultado = await atualizarMercadoLivreManuaisViaHttp();
    const alertas = await avaliarAlertasDePreco();
    return Response.json({ sucesso: true, resultado, alertas });
  } catch (erro) {
    return Response.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido",
    }, { status: 500 });
  }
}
