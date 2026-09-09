import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERY = '"Kit 2expositor De Esmaltes De Parede Com Led (mdf Preto)" Mercado Livre';

export async function GET() {
  const urls = [
    `https://www.google.com/search?q=${encodeURIComponent(QUERY)}&hl=pt-BR`,
    `https://www.bing.com/search?q=${encodeURIComponent(QUERY)}&setlang=pt-br`,
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(QUERY)}`,
  ];

  const resultados = [];

  for (const url of urls) {
    try {
      const resposta = await fetch(url, {
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
      const lower = html.toLowerCase();
      const alvo = "kit 2expositor";
      const indice = lower.indexOf(alvo);
      const trecho = indice >= 0
        ? html.slice(Math.max(0, indice - 2500), indice + 9000)
        : html.slice(0, 12000);

      resultados.push({
        url,
        status: resposta.status,
        urlFinal: resposta.url,
        bytes: html.length,
        encontrouTitulo: indice >= 0,
        trecho,
      });
    } catch (error) {
      resultados.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ resultados });
}
