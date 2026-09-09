import { NextResponse } from "next/server";
import { extrairOfertasMercadoLivre } from "@/lib/economize/extratores/mercadoLivreOfertas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL = "https://lista.mercadolivre.com.br/kit-2-expositor-de-esmaltes-de-parede-com-led-mdf-preto";

export async function GET() {
  try {
    const resposta = await fetch(URL, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      },
      signal: AbortSignal.timeout(30000),
    });
    const html = await resposta.text();
    const ofertas = extrairOfertasMercadoLivre(html, URL);
    return NextResponse.json({
      status: resposta.status,
      urlFinal: resposta.url,
      bytes: html.length,
      verificacao: /account-verification|captcha|acesse sua conta/i.test(`${resposta.url} ${html}`),
      total: ofertas.length,
      primeiras: ofertas.slice(0, 5),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
