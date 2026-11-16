export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const fonte = "https://www.decolar.com/black-friday";
  const resposta = await fetch(fonte, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  const html = await resposta.text();
  const limpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  const encontrados = new Map<string,string>();
  const regex = /(?:cupom\s*:?\s*|aproveite\s+o\s+cupom\s+)([A-Z0-9_-]{4,24})(?=\s|$)/gi;
  for (const match of limpo.matchAll(regex)) {
    const codigo=String(match[1]||"").toUpperCase();
    const i=match.index||0;
    encontrados.set(codigo, limpo.slice(Math.max(0,i-180), Math.min(limpo.length,i+180)));
  }
  return Response.json({
    sucesso: resposta.ok,
    status: resposta.status,
    bytes: html.length,
    quantidade: encontrados.size,
    codigos: Array.from(encontrados.entries()).map(([codigo,contexto])=>({codigo,contexto})),
  });
}
