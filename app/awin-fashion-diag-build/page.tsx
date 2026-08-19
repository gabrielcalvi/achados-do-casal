import { Readable } from "stream";
import { createGunzip } from "zlib";

export const dynamic = "force-static";

type Row = Record<string, string>;

function texto(valor: unknown) { return String(valor ?? "").trim(); }
function chave(valor: string) {
  return texto(valor).replace(/^\uFEFF/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function campo(row: Row, nomes: string[]) {
  for (const nome of nomes) {
    const valor = row[chave(nome)];
    if (valor !== undefined && texto(valor)) return texto(valor);
  }
  return "";
}
function numero(valor: unknown) {
  let s = texto(valor).replace(/[^0-9,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(conteudo: string, delimitador = ",") {
  const linhas: string[][] = [];
  let linha: string[] = [], valor = "", aspas = false;
  const fecharCampo = () => { linha.push(valor); valor = ""; };
  const fecharLinha = () => { fecharCampo(); if (linha.some((v) => texto(v))) linhas.push(linha); linha = []; };
  for (let i = 0; i < conteudo.length; i += 1) {
    const c = conteudo[i];
    if (aspas) {
      if (c === '"' && conteudo[i + 1] === '"') { valor += '"'; i += 1; }
      else if (c === '"') aspas = false;
      else valor += c;
    } else if (c === '"' && valor.length === 0) aspas = true;
    else if (c === delimitador) fecharCampo();
    else if (c === "\n") fecharLinha();
    else if (c !== "\r") valor += c;
  }
  if (valor.length || linha.length) fecharLinha();
  if (!linhas.length) return [] as Row[];
  const headers = linhas[0].map(chave);
  return linhas.slice(1).map((vals) => Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""])));
}

async function streamFeed(url: string, onRow: (row: Row) => void) {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!resposta.ok || !resposta.body) throw new Error(`Feed HTTP ${resposta.status}`);
  const origem = Readable.fromWeb(resposta.body as never);
  const iterator = origem[Symbol.asyncIterator]();
  const primeiro = await iterator.next();
  async function* recomposto() {
    if (!primeiro.done && primeiro.value) yield primeiro.value;
    for (;;) { const p = await iterator.next(); if (p.done) break; yield p.value; }
  }
  const bytes = primeiro.value as Buffer | undefined;
  const gzip = Boolean(bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  const stream = gzip ? Readable.from(recomposto()).pipe(createGunzip()) : Readable.from(recomposto());
  const decoder = new TextDecoder("utf-8");
  let headers: string[] | null = null, linha: string[] = [], valor = "", aspas = false, aposAspa = false;
  const fecharCampo = () => { linha.push(valor); valor = ""; };
  const emitir = () => {
    fecharCampo();
    if (!linha.some((v) => texto(v))) { linha = []; return; }
    if (!headers) headers = linha.map(chave);
    else onRow(Object.fromEntries(headers.map((h, i) => [h, linha[i] ?? ""])));
    linha = [];
  };
  const processar = (chunk: string) => {
    for (let i = 0; i < chunk.length; i += 1) {
      const c = chunk[i];
      if (aspas) { if (c === '"') { aspas = false; aposAspa = true; } else valor += c; continue; }
      if (aposAspa) { if (c === '"') { valor += '"'; aspas = true; aposAspa = false; continue; } aposAspa = false; }
      if (c === '"' && valor.length === 0) aspas = true;
      else if (c === ",") fecharCampo();
      else if (c === "\n") emitir();
      else if (c !== "\r") valor += c;
    }
  };
  for await (const chunk of stream) processar(decoder.decode(chunk as Buffer, { stream: true }));
  processar(decoder.decode());
  if (valor.length || linha.length) emitir();
}

export default async function FashionDiagBuildPage() {
  try {
    const key = process.env.AWIN_DATAFEED_API_KEY;
    if (!key) throw new Error("AWIN_DATAFEED_API_KEY ausente");
    const resposta = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(60000) });
    const corpo = await resposta.text();
    if (!resposta.ok) throw new Error(`Lista feeds HTTP ${resposta.status}`);
    const rows = parseCsv(corpo, ",");

    const moda = rows.filter((row) => {
      const nome = campo(row, ["Advertiser", "Advertiser Name", "Merchant Name"]).toLowerCase();
      return /renner|ashua/.test(nome);
    }).map((row) => ({
      advertiser_id: campo(row, ["Advertiser ID", "merchant_id"]),
      advertiser: campo(row, ["Advertiser", "Advertiser Name", "Merchant Name"]),
      feed_id: campo(row, ["Feed ID", "feed_id"]),
      feed_name: campo(row, ["Feed Name", "feed_name"]),
      membership_status: campo(row, ["Membership Status", "membership_status"]),
      language: campo(row, ["Language"]),
      primary_region: campo(row, ["Primary Region"]),
      tem_url: Boolean(campo(row, ["URL", "download_url"])),
    }));
    console.log("[AWIN RENNER ASHUA FEEDS EXATOS]", JSON.stringify(moda));

    const feedsCea = rows.filter((row) => campo(row, ["Advertiser ID", "merchant_id"]) === "17648" && campo(row, ["URL", "download_url"]));
    let total = 0, comDesconto = 0, acima10 = 0;
    const top: Array<{ id: string; titulo: string; atual: number; original: number; desconto: number; afiliado: string }> = [];
    for (const feed of feedsCea) {
      await streamFeed(campo(feed, ["URL", "download_url"]), (row) => {
        total += 1;
        const atual = numero(campo(row, ["search_price", "sale_price", "price"]));
        const original = numero(campo(row, ["rrp_price", "base_price", "old_price"]));
        if (!atual || !original || original <= atual) return;
        const desconto = Math.round(((original - atual) / original) * 1000) / 10;
        comDesconto += 1;
        if (desconto < 10) return;
        acima10 += 1;
        top.push({
          id: campo(row, ["aw_product_id", "merchant_product_id"]),
          titulo: campo(row, ["product_name", "title"]),
          atual,
          original,
          desconto,
          afiliado: campo(row, ["aw_deep_link", "awin_deep_link"]),
        });
        top.sort((a, b) => b.desconto - a.desconto || (b.original - b.atual) - (a.original - a.atual));
        if (top.length > 30) top.length = 30;
      });
    }
    console.log("[AWIN CEA DESCONTOS]", JSON.stringify({ feeds: feedsCea.length, total, comDesconto, acima10, top }));
  } catch (erro) {
    console.log("[AWIN FASHION DIAG ERRO]", erro instanceof Error ? erro.message : String(erro));
  }
  return <main>Diagnóstico AWIN moda.</main>;
}
