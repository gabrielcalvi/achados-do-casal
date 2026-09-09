import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BASE = "https://heroic-benevolence-production-1ccf.up.railway.app";
const LINK = "https://www.mercadolivre.com.br/p/MLB26264031?matt_tool=38524122&pdp_filters=item_id:MLB5982398014&ua=42KcEQXIE2GA0k4kB0RnrMHoRWBJJpjTKNUd5fJv6vxi-kI#origin=share&sid=share&wid=MLB5982398014&action=whatsapp";

export async function GET() {
  const resultado: Record<string, unknown> = {};

  try {
    const health = await fetch(`${BASE}/health`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    resultado.healthStatus = health.status;
    resultado.health = (await health.text()).slice(0, 2000);
  } catch (error) {
    resultado.healthError = error instanceof Error ? error.message : String(error);
  }

  try {
    const resposta = await fetch(`${BASE}/extrair?url=${encodeURIComponent(LINK)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
    resultado.extrairStatus = resposta.status;
    resultado.extrair = (await resposta.text()).slice(0, 10000);
  } catch (error) {
    resultado.extrairError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(resultado);
}
