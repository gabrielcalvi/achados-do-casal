import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK = "https://www.mercadolivre.com.br/p/MLB26264031?matt_tool=38524122&pdp_filters=item_id:MLB5982398014&ua=42KcEQXIE2GA0k4kB0RnrMHoRWBJJpjTKNUd5fJv6vxi-kI#origin=share&sid=share&wid=MLB5982398014&action=whatsapp";

export async function GET() {
  const url = new URL("https://api.microlink.io");
  url.searchParams.set("url", LINK);
  url.searchParams.set("prerender", "true");
  url.searchParams.set("meta", "true");
  url.searchParams.set("data.nome.selector", "h1.ui-pdp-title");
  url.searchParams.set("data.nome.type", "string");
  url.searchParams.set("data.precoAtual.selector", ".ui-pdp-price__second-line .andes-money-amount__fraction");
  url.searchParams.set("data.precoAtual.type", "string");
  url.searchParams.set("data.precoAntigo.selector", ".ui-pdp-price__original-value .andes-money-amount__fraction");
  url.searchParams.set("data.precoAntigo.type", "string");
  url.searchParams.set("data.parcelas.selector", ".ui-pdp-price__subtitles");
  url.searchParams.set("data.parcelas.type", "string");

  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });
    const texto = await resposta.text();
    return NextResponse.json({
      status: resposta.status,
      ok: resposta.ok,
      corpo: texto.slice(0, 20000),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
