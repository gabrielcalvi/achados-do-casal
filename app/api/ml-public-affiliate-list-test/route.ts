export const dynamic = "force-dynamic";
export const revalidate = 0;

const LISTA_PUBLICA = "https://www.mercadolivre.com.br/social/criticalhits/lists/a1aa53d0-d919-481b-ac75-8de98376173c?matt_tool=62729399";

function extrairAmostras(html: string) {
  const precos = [...html.matchAll(/R\$\s*[0-9.]+(?:,[0-9]{2})?/g)]
    .slice(0, 20)
    .map((m) => m[0]);

  const links = [...html.matchAll(/https?:\\?\/\\?\/(?:www\.)?mercadolivre\.com\.br[^"'<>\\\s]+/gi)]
    .slice(0, 20)
    .map((m) => m[0].replace(/\\\//g, "/"));

  const mlb = [...new Set([...html.matchAll(/MLB\d{8,}/g)].map((m) => m[0]))].slice(0, 20);

  return { precos, links, mlb };
}

export async function GET() {
  const resposta = await fetch(LISTA_PUBLICA, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36",
      "accept-language": "pt-BR,pt;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30000),
  });

  const html = await resposta.text();
  const lower = html.toLowerCase();
  const verificacao =
    resposta.url.includes("/gz/account-verification") ||
    lower.includes("verificação de segurança") ||
    lower.includes("verificacao de seguranca") ||
    lower.includes("security verification");

  return Response.json({
    sucesso: true,
    modo: "somente_leitura",
    fonte: "lista_publica_afiliado",
    status: resposta.status,
    url_final: resposta.url,
    bytes: html.length,
    verificacao,
    tem_next_data: html.includes("__NEXT_DATA__"),
    tem_preco_textual: /R\$\s*[0-9]/.test(html),
    amostras: verificacao ? { precos: [], links: [], mlb: [] } : extrairAmostras(html),
  });
}
