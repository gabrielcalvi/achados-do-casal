import { Readable } from "stream";
import { createGunzip } from "zlib";

export const dynamic = "force-static";

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function chave(valor: string) {
  return texto(valor).replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseCsv(conteudo: string, delimitador = ",") {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;

  const fecharCampo = () => { linha.push(campo); campo = ""; };
  const fecharLinha = () => { fecharCampo(); if (linha.some((v) => texto(v))) linhas.push(linha); linha = []; };

  for (let i = 0; i < conteudo.length; i += 1) {
    const c = conteudo[i];
    if (aspas) {
      if (c === '"' && conteudo[i + 1] === '"') { campo += '"'; i += 1; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo.length === 0) aspas = true;
    else if (c === delimitador) fecharCampo();
    else if (c === "\n") fecharLinha();
    else if (c !== "\r") campo += c;
  }
  if (campo.length || linha.length) fecharLinha();
  if (!linhas.length) return [] as Record<string, string>[];
  const headers = linhas[0].map(chave);
  return linhas.slice(1).map((valores) => Object.fromEntries(headers.map((h, i) => [h, valores[i] ?? ""])));
}

async function primeirasLinhasFeed(url: string) {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!resposta.ok || !resposta.body) throw new Error(`Feed HTTP ${resposta.status}`);
  const origem = Readable.fromWeb(resposta.body as never);
  const iterator = origem[Symbol.asyncIterator]();
  const primeiro = await iterator.next();
  async function* recomposto() {
    if (!primeiro.done && primeiro.value) yield primeiro.value;
    for (;;) {
      const proximo = await iterator.next();
      if (proximo.done) break;
      yield proximo.value;
    }
  }
  const bytes = primeiro.value as Buffer | undefined;
  const gzip = Boolean(bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  const stream = gzip ? Readable.from(recomposto()).pipe(createGunzip()) : Readable.from(recomposto());
  let buffer = "";
  for await (const chunk of stream) {
    buffer += Buffer.from(chunk).toString("utf8");
    if (buffer.split("\n").length >= 5 || buffer.length > 50000) {
      stream.destroy();
      break;
    }
  }
  return buffer.split(/\r?\n/).filter(Boolean).slice(0, 4);
}

export default async function FashionDiagBuildPage() {
  try {
    const key = process.env.AWIN_DATAFEED_API_KEY;
    if (!key) throw new Error("AWIN_DATAFEED_API_KEY ausente");
    const resposta = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(60000) });
    const corpo = await resposta.text();
    if (!resposta.ok) throw new Error(`Lista feeds HTTP ${resposta.status}`);
    const rows = parseCsv(corpo, ",");
    const encontrados = rows.filter((row) => {
      const dump = Object.values(row).join(" ").toLowerCase();
      return dump.includes("renner") || dump.includes("ashua") || dump.includes("c&a") || dump.includes("cea");
    });

    const resumo = encontrados.slice(0, 30).map((row) => ({
      advertiser_id: row.advertiser_id || row.merchant_id || row.advertiserid,
      advertiser: row.advertiser || row.advertiser_name || row.merchant_name,
      feed_id: row.feed_id,
      feed_name: row.feed_name,
      membership_status: row.membership_status,
      language: row.language,
      primary_region: row.primary_region,
      url: row.url ? "presente" : "ausente",
    }));
    console.log("[AWIN FASHION FEEDS]", JSON.stringify(resumo));

    const cea = encontrados.find((row) => String(row.advertiser_id || row.merchant_id || "") === "17648" && row.url);
    if (cea?.url) {
      const linhas = await primeirasLinhasFeed(cea.url);
      console.log("[AWIN CEA FEED PRIMEIRAS LINHAS]", JSON.stringify(linhas));
    }
  } catch (erro) {
    console.log("[AWIN FASHION DIAG ERRO]", erro instanceof Error ? erro.message : String(erro));
  }
  return <main>Diagnóstico AWIN moda.</main>;
}
