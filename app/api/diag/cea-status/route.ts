import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export async function GET() {
  try {
    const key = process.env.AWIN_DATAFEED_API_KEY?.trim();
    if (!key) return NextResponse.json({ sucesso: false, erro: "AWIN_DATAFEED_API_KEY ausente" }, { status: 500 });

    const response = await fetch(`https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(key)}`, {
      headers: { Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const text = await response.text();
    if (!response.ok) return NextResponse.json({ sucesso: false, erro: `AWIN HTTP ${response.status}` }, { status: 502 });

    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]).map((v) => v.trim());
    const idx = (names: string[]) => headers.findIndex((h) => names.some((n) => h.toLowerCase() === n.toLowerCase()));
    const advertiserIdIdx = idx(["Advertiser ID", "advertiser_id"]);
    const advertiserIdx = idx(["Advertiser", "Advertiser Name", "advertiser_name"]);
    const feedIdIdx = idx(["Feed ID", "feed_id"]);
    const feedNameIdx = idx(["Feed Name", "feed_name"]);
    const languageIdx = idx(["Language", "language"]);
    const regionIdx = idx(["Primary Region", "primary_region"]);
    const statusIdx = idx(["Membership Status", "membership_status"]);

    const matches = lines.slice(1).map(parseCsvLine).filter((cols) => {
      const hay = cols.join(" ").toLowerCase();
      return hay.includes("casas bahia") || hay.includes("casasbahia") || hay.includes("bahia");
    }).map((cols) => ({
      advertiserId: advertiserIdIdx >= 0 ? cols[advertiserIdIdx] : null,
      advertiser: advertiserIdx >= 0 ? cols[advertiserIdx] : null,
      feedId: feedIdIdx >= 0 ? cols[feedIdIdx] : null,
      feedName: feedNameIdx >= 0 ? cols[feedNameIdx] : null,
      language: languageIdx >= 0 ? cols[languageIdx] : null,
      region: regionIdx >= 0 ? cols[regionIdx] : null,
      membership: statusIdx >= 0 ? cols[statusIdx] : null,
    })).slice(0, 20);

    return NextResponse.json({ sucesso: true, totalFeeds: lines.length - 1, matches });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}
