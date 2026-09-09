import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvSplit(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export async function GET() {
  const key = process.env.AWIN_DATAFEED_API_KEY?.trim();
  if (!key) return NextResponse.json({ sucesso: false, erro: "AWIN_DATAFEED_API_KEY ausente" }, { status: 500 });

  const r = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`, {
    cache: "no-store",
    headers: { Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  if (!r.ok) return NextResponse.json({ sucesso: false, erro: `HTTP ${r.status}`, detalhe: text.slice(0, 500) }, { status: 500 });

  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = csvSplit(lines[0] || "");
  const rows = lines.slice(1).map((line) => {
    const vals = csvSplit(line);
    return Object.fromEntries(header.map((h, i) => [h, vals[i] ?? ""]));
  });
  const candidatos = rows.filter((row) => /cobasi/i.test(JSON.stringify(row)));

  return NextResponse.json({ sucesso: true, total: rows.length, header, candidatos }, { headers: { "Cache-Control": "no-store" } });
}
