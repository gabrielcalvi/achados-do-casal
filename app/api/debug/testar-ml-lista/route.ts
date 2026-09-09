import { NextResponse } from "next/server";
import { load } from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERIES = [
  '"Kit 2expositor De Esmaltes De Parede Com Led (mdf Preto)" Mercado Livre',
  'site:mercadolivre.com.br "Kit 2expositor De Esmaltes De Parede Com Led"',
  'site:mercadolivre.com.br expositor esmaltes parede led mdf preto',
];

export async function GET() {
  const resultados = [];

  for (const query of QUERIES) {
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}&setlang=pt-br`;

    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: {
          Accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
        },
        signal: AbortSignal.timeout(30000),
      });

      const xml = await resposta.text();
      const $ = load(xml, { xmlMode: true });
      const itens = $("item")
        .toArray()
        .slice(0, 10)
        .map((item) => ({
          title: $(item).find("title").first().text().trim(),
          link: $(item).find("link").first().text().trim(),
          description: $(item).find("description").first().text().trim(),
        }));

      resultados.push({
        query,
        status: resposta.status,
        bytes: xml.length,
        itens,
      });
    } catch (error) {
      resultados.push({
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ resultados });
}
