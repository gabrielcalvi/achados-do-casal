import { NextResponse } from "next/server";
import { load } from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL = "https://lista.mercadolivre.com.br/enxada-antifaiscante";
const ITEM = "MLB5652208776";
const UP = "MLBU3388038385";

function limpar(texto: string | undefined | null) {
  return String(texto || "").replace(/\s+/g, " ").trim();
}

export async function GET() {
  const resposta = await fetch(URL, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  const html = await resposta.text();
  const $ = load(html);
  const cards: Array<Record<string, unknown>> = [];

  $("li.ui-search-layout__item, div.poly-card, div.ui-search-result").each((_, el) => {
    const card = $(el);
    const link = card.find("a[href]").first().attr("href") || "";
    const titulo = limpar(
      card.find("h2, .poly-component__title, .ui-search-item__title").first().text()
    );
    const imagemEl = card.find("img").first();
    const imagem =
      imagemEl.attr("data-src") ||
      imagemEl.attr("src") ||
      imagemEl.attr("data-lazy") ||
      "";
    const srcset = imagemEl.attr("srcset") || imagemEl.attr("data-srcset") || "";
    const texto = limpar(card.text());
    const exatoId = link.toUpperCase().includes(ITEM) || link.toUpperCase().includes(UP);
    const exatoPreco = /44[,.]69/.test(texto) && /42[,.]29/.test(texto);
    const exatoTitulo = /kit\s+p[aá]\s*\+?\s*enxada\s+anti[- ]?faiscante/i.test(titulo);

    if (exatoId || (exatoPreco && exatoTitulo)) {
      cards.push({ link, titulo, imagem, srcset, texto, exatoId, exatoPreco, exatoTitulo });
    }
  });

  return NextResponse.json({
    status: resposta.status,
    urlFinal: resposta.url,
    bytes: html.length,
    bloqueado: /account-verification|captcha/i.test(resposta.url + html.slice(0, 5000)),
    totalCards: $("li.ui-search-layout__item, div.poly-card, div.ui-search-result").length,
    encontrados: cards,
    contemItemNoHtml: html.toUpperCase().includes(ITEM),
    contemUpNoHtml: html.toUpperCase().includes(UP),
  });
}
