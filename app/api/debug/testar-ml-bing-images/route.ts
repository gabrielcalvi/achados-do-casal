import { NextResponse } from "next/server";
import { load } from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERIES = [
  '"MLB5652208776"',
  '"MLBU3388038385"',
  '"Kit Pá Enxada Anti-faiscante Plástica Cabo De Madeira 50cm" Mercado Livre',
];

function normalizarUrl(valor: unknown) {
  const url = String(valor || "").replace(/\\u002f/gi, "/").replace(/\\\//g, "/").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

export async function GET() {
  const saida = [];

  for (const query of QUERIES) {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3&first=1&count=100`;

    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
        },
        signal: AbortSignal.timeout(30000),
      });
      const html = await resposta.text();
      const $ = load(html);
      const imagens: Array<{ murl: string; purl: string; turl: string; title: string }> = [];

      $("a.iusc").each((_, elemento) => {
        const bruto = $(elemento).attr("m");
        if (!bruto) return;
        try {
          const meta = JSON.parse(bruto) as Record<string, unknown>;
          const murl = normalizarUrl(meta.murl);
          const purl = normalizarUrl(meta.purl);
          const turl = normalizarUrl(meta.turl);
          const title = String(meta.t || "").trim();
          if (murl || turl) imagens.push({ murl, purl, turl, title });
        } catch {
          // ignora cards sem JSON valido
        }
      });

      const mlstatic = imagens.filter((item) =>
        /mlstatic\.com|mercadolivre\.com\.br|mercadolibre\.com/i.test(`${item.murl} ${item.purl} ${item.turl}`)
      );

      saida.push({
        query,
        status: resposta.status,
        bytes: html.length,
        total: imagens.length,
        mlstatic: mlstatic.slice(0, 50),
      });
    } catch (error) {
      saida.push({
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ saida });
}
