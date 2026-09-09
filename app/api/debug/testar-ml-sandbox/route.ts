import { NextResponse } from "next/server";
import { criarSessaoMonitorMercadoLivre } from "@/lib/services/mercadoLivreSandboxMonitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LINK_TESTE =
  "https://www.mercadolivre.com.br/p/MLB26264031?matt_tool=38524122&pdp_filters=item_id:MLB5982398014&ua=42KcEQXIE2GA0k4kB0RnrMHoRWBJJpjTKNUd5fJv6vxi-kI#origin=share&sid=share&wid=MLB5982398014&action=whatsapp";

export async function GET() {
  const inicio = Date.now();
  let sessao: Awaited<ReturnType<typeof criarSessaoMonitorMercadoLivre>> | null = null;

  try {
    sessao = await criarSessaoMonitorMercadoLivre();
    const dados = await sessao.extrair(LINK_TESTE);

    return NextResponse.json({
      sucesso: true,
      duracaoMs: Date.now() - inicio,
      dados,
    });
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        duracaoMs: Date.now() - inicio,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (sessao) {
      await sessao.fechar().catch(() => undefined);
    }
  }
}
