import { gunzipSync } from "node:zlib";

export const dynamic = "force-static";

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export default async function KabumFeedDiagBuildPage() {
  try {
    const key = process.env.AWIN_DATAFEED_API_KEY;
    if (!key) throw new Error("AWIN_DATAFEED_API_KEY ausente");

    const listaResp = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`, { cache: "no-store" });
    const lista = await listaResp.text();
    if (!listaResp.ok) throw new Error(`Lista HTTP ${listaResp.status}`);

    const linhas = lista.split(/\r?\n/).filter(Boolean);
    const cabLista = parseCsvLine(linhas[0]);
    const idxAdv = cabLista.findIndex((v) => v.toLowerCase().includes("advertiser id"));
    const idxUrl = cabLista.findIndex((v) => v.toLowerCase() === "url");
    const linhaKabum = linhas.slice(1).map(parseCsvLine).find((r) => String(r[idxAdv] || "").trim() === "17729");
    if (!linhaKabum || idxUrl < 0) throw new Error("Feed KaBuM nao localizado");

    const feedResp = await fetch(linhaKabum[idxUrl], { cache: "no-store" });
    const bytes = Buffer.from(await feedResp.arrayBuffer());
    if (!feedResp.ok) throw new Error(`Feed HTTP ${feedResp.status}`);
    const descompactado = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    const texto = descompactado.toString("utf8");

    const feedLinhas = texto.split(/\r?\n/).filter(Boolean).slice(0, 5);
    const cab = parseCsvLine(feedLinhas[0]);
    const amostras = feedLinhas.slice(1).map((linha) => {
      const valores = parseCsvLine(linha);
      const obj: Record<string, string> = {};
      for (let i = 0; i < cab.length; i += 1) {
        const chave = cab[i];
        if (/price|saving|discount|stock|sale|offer|link|url|currency|availability|product.?id|product.?name|image/i.test(chave)) {
          obj[chave] = String(valores[i] || "").slice(0, 220);
        }
      }
      return obj;
    });

    console.log("[KABUM FEED HEADERS]", JSON.stringify(cab));
    console.log("[KABUM FEED SAMPLES]", JSON.stringify(amostras));
  } catch (erro) {
    console.log("[KABUM FEED DIAG ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Diagnóstico temporário de feed KaBuM.</main>;
}
