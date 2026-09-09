import { NextResponse } from "next/server";
import { load } from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALVO = "Kit Pá Enxada Anti-faiscante Plástica Cabo De Madeira 50cm";
const QUERIES = [
  '"MLB5652208776"',
  '"MLBU3388038385"',
  `"${ALVO}"`,
  `${ALVO} PLASTCOR`,
];

function normalizarUrl(valor: unknown) {
  const url = String(valor || "").replace(/\\u002f/gi, "/").replace(/\\\//g, "/").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similaridade(titulo: string) {
  const alvo = normalizarTexto(ALVO).split(" ").filter((t) => t.length > 2);
  const teste = new Set(normalizarTexto(titulo).split(" ").filter(Boolean));
  const comuns = alvo.filter((t) => teste.has(t)).length;
  return alvo.length ? Math.round((comuns / alvo.length) * 100) : 0;
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
      const imagens: Array<{ murl: string; purl: string; turl: string; title: string; score: number }> = [];

      $("a.iusc").each((_, elemento) => {
        const bruto = $(elemento).attr("m");
        if (!bruto) return;
        try {
          const meta = JSON.parse(bruto) as Record<string, unknown>;
          const murl = normalizarUrl(meta.murl);
          const purl = normalizarUrl(meta.purl);
          const turl = normalizarUrl(meta.turl);
          const title = String(meta.t || "").trim();
          if (murl || turl) imagens.push({ murl, purl, turl, title, score: similaridade(title) });
        } catch {
          // ignora cards sem JSON valido
        }
      });

      const candidatos = imagens
        .filter((item) => item.score >= 55)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);

      saida.push({
        query,
        status: resposta.status,
        total: imagens.length,
        candidatos,
        amostra: imagens.slice(0, 12),
      });
    } catch (error) {
      saida.push({ query, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ saida });
}
