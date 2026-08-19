export const dynamic = "force-static";

function limpar(texto: string) {
  return texto.replace(/\/apikey\/[^/]+/gi, "/apikey/[redacted]").slice(0, 4000);
}

async function diagnosticar() {
  if (process.env.VERCEL_ENV !== "production") return "ignorado";

  const key = process.env.AWIN_DATAFEED_API_KEY?.trim();
  if (!key) throw new Error("AWIN_DATAFEED_API_KEY ausente em producao.");

  const resposta = await fetch(
    `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`,
    { headers: { Accept: "text/csv,text/plain,*/*" }, signal: AbortSignal.timeout(60000) },
  );

  const conteudo = await resposta.text();
  if (!resposta.ok) throw new Error(`Feed list HTTP ${resposta.status}`);

  const linhas = conteudo.split(/\r?\n/);
  const cabecalho = linhas[0] || "";
  const nike = linhas.filter((linha) => /(^|,)\s*17652\s*(,|$)/.test(linha) || linha.toLowerCase().includes("nike"));

  console.log(`[NIKE FEED LIST] CABECALHO: ${limpar(cabecalho)}`);
  console.log(`[NIKE FEED LIST] TOTAL_LINHAS_NIKE=${nike.length}`);
  for (const linha of nike.slice(0, 20)) {
    console.log(`[NIKE FEED LIST] LINHA: ${limpar(linha)}`);
  }

  return `nike_rows=${nike.length}`;
}

export default async function NikeFeedListDiagnostico() {
  const status = await diagnosticar();
  return <main>{status}</main>;
}
