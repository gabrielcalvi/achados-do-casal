import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LINK = "https://www.mercadolivre.com.br/p/MLB26264031?matt_tool=38524122&pdp_filters=item_id:MLB5982398014&ua=42KcEQXIE2GA0k4kB0RnrMHoRWBJJpjTKNUd5fJv6vxi-kI#origin=share&sid=share&wid=MLB5982398014&action=whatsapp";

export async function GET() {
  const url = `https://r.jina.ai/${LINK}`;

  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/plain, text/markdown;q=0.9, */*;q=0.8",
        "X-Return-Format": "markdown",
      },
      signal: AbortSignal.timeout(90000),
    });
    const texto = await resposta.text();
    return NextResponse.json({
      status: resposta.status,
      ok: resposta.ok,
      bytes: texto.length,
      corpo: texto.slice(0, 30000),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
