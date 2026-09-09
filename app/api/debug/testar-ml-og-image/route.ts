import { NextResponse } from "next/server";
import { load } from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK = "https://www.mercadolivre.com.br/kit-pa--enxada-antifaiscante-plastica-cabo-de-madeira-50cm/up/MLBU3388038385?pdp_filters=price%3A*-45#polycard_client=search-desktop&be_origin=backend&overlay_label=not_apply&search_layout=grid&position=58&type=product&tracking_id=0270a58f-d59f-4cd0-9888-ab256e1bc161&wid=MLB5652208776&sid=search";

const AGENTES: Record<string, string> = {
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  whatsapp: "WhatsApp/2.26.0 A",
  twitter: "Twitterbot/1.0",
  google: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bing: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  discord: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
};

export async function GET() {
  const resultados: Record<string, unknown> = {};

  for (const [nome, userAgent] of Object.entries(AGENTES)) {
    try {
      const resposta = await fetch(LINK, {
        redirect: "follow",
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9",
          "User-Agent": userAgent,
        },
        signal: AbortSignal.timeout(20000),
      });

      const html = await resposta.text();
      const $ = load(html);
      const imagens = [
        $('meta[property="og:image"]').attr("content") || "",
        $('meta[name="twitter:image"]').attr("content") || "",
        ...$('script[type="application/ld+json"]')
          .toArray()
          .flatMap((elemento) => {
            const texto = $(elemento).text();
            const achados = texto.match(/https?:\\?\/\\?\/[^"'<>\\s]+(?:jpg|jpeg|png|webp)/gi) || [];
            return achados.map((url) => url.replace(/\\\//g, "/"));
          }),
      ].filter((url) => /^https?:\/\//i.test(url));

      resultados[nome] = {
        status: resposta.status,
        urlFinal: resposta.url,
        bytes: html.length,
        titulo: $('meta[property="og:title"]').attr("content") || $("title").text().trim(),
        imagens: Array.from(new Set(imagens)).slice(0, 20),
        bloqueado: /account-verification|captcha|para continuar, acesse sua conta/i.test(`${resposta.url} ${html}`),
      };
    } catch (error) {
      resultados[nome] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json(resultados);
}
