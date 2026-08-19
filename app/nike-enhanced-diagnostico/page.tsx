export const dynamic = "force-static";

const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID || "2922231";
const ADVERTISER_ID = "17652";

function resumo(texto: string) {
  return texto
    .replace(/https?:\/\/[^\s\"']+/g, "[url]")
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

async function diagnosticar() {
  if (process.env.VERCEL_ENV !== "production") return "ignorado";

  const token = process.env.AWIN_API_TOKEN?.trim();
  if (!token) throw new Error("AWIN_API_TOKEN ausente em producao.");

  const candidatos = [
    `https://api.awin.com/publishers/${PUBLISHER_ID}/awinfeeds/download/${ADVERTISER_ID}-retail-pt_BR.jsonl`,
    `https://api.awin.com/publishers/${PUBLISHER_ID}/awinfeeds/download/${ADVERTISER_ID}-retail-pt_BR`,
    `https://api.awin.com/publishers/${PUBLISHER_ID}/awinfeeds/download/${ADVERTISER_ID}-retail-pt-BR.jsonl`,
  ];

  const resultados: Array<Record<string, unknown>> = [];

  for (const url of candidatos) {
    try {
      const resposta = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json,application/x-ndjson,text/plain,*/*",
        },
        signal: AbortSignal.timeout(30000),
      });

      const texto = await resposta.text();
      resultados.push({
        caminho: new URL(url).pathname,
        status: resposta.status,
        contentType: resposta.headers.get("content-type"),
        contentLength: resposta.headers.get("content-length"),
        amostra: resumo(texto),
      });
    } catch (erro) {
      resultados.push({
        caminho: new URL(url).pathname,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  console.log(`[NIKE ENHANCED DIAGNOSTICO] ${JSON.stringify(resultados)}`);
  return "diagnosticado";
}

export default async function NikeEnhancedDiagnosticoPage() {
  const status = await diagnosticar();
  return <main>nike enhanced: {status}</main>;
}
