import { createClient } from "@/lib/supabase/server";
import { atualizarMercadoLivreManuaisViaHttp } from "@/lib/services/mercadoLivreHttpMonitor";
import { avaliarAlertasDePreco } from "@/lib/services/priceAlerts";

async function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();

  if (segredo && request.headers.get("authorization") === `Bearer ${segredo}`) {
    return true;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await autorizado(request))) {
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
