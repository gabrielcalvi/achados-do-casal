export const dynamic = "force-static";

const PUBLISHER = "2922231";
const ADVERTISER = "70694";
const LOCALES = ["pt_BR", "pt_PT", "en_BR"];

export default async function RennerEnhancedBuildPage() {
  try {
    const token = process.env.AWIN_API_TOKEN;
    if (!token) throw new Error("AWIN_API_TOKEN ausente");

    const resultados = [];
    for (const locale of LOCALES) {
      const url = `https://api.awin.com/publishers/${PUBLISHER}/awinfeeds/download/${ADVERTISER}-retail-${locale}.jsonl`;
      const resposta = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json,application/x-ndjson,text/plain,*/*",
        },
        signal: AbortSignal.timeout(60000),
      });
      const corpo = await resposta.text();
      resultados.push({
        locale,
        status: resposta.status,
        contentType: resposta.headers.get("content-type"),
        tamanho: corpo.length,
        amostra: corpo.slice(0, 1200),
      });
    }
    console.log("[AWIN RENNER ENHANCED]", JSON.stringify(resultados));
  } catch (erro) {
    console.log("[AWIN RENNER ENHANCED ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Diagnóstico Enhanced Feed Renner.</main>;
}
