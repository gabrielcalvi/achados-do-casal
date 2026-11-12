import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHAVE = "lri-8f6c71d2c9b1a46e";

function parseCsvLinha(linha: string) {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];

    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else {
        aspas = !aspas;
      }
    } else if (c === "," && !aspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }

  campos.push(atual);
  return campos;
}

function chave(valor: string) {
  return valor
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== CHAVE) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY?.trim();
  if (!datafeedKey) {
    return NextResponse.json({ erro: "AWIN_DATAFEED_API_KEY ausente." }, { status: 500 });
  }

  const endpoint =
    `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(datafeedKey)}`;

  const resposta = await fetch(endpoint, {
    headers: { Accept: "text/csv,text/plain,*/*" },
    cache: "no-store",
  });

  const texto = await resposta.text();

  if (!resposta.ok) {
    return NextResponse.json(
      { erro: "Awin Data Feed recusou a consulta.", status: resposta.status },
      { status: 502 }
    );
  }

  const linhas = texto.split(/\r?\n/).filter(Boolean);
  if (!linhas.length) {
    return NextResponse.json({ matches: [], total: 0 });
  }

  const cabecalhos = parseCsvLinha(linhas[0]).map(chave);
  const objetos = linhas.slice(1).map((linha) => {
    const valores = parseCsvLinha(linha);
    const obj: Record<string, string> = {};
    cabecalhos.forEach((h, i) => {
      if (h) obj[h] = valores[i] || "";
    });
    return obj;
  });

  const matches = objetos
    .filter((item) => JSON.stringify(item).toLowerCase().includes("lauri"))
    .map((item) => ({
      advertiserId:
        item.advertiser_id ||
        item.advertiserid ||
        item.merchant_id ||
        null,
      advertiser:
        item.advertiser ||
        item.advertiser_name ||
        item.merchant_name ||
        null,
      feedId: item.feed_id || null,
      feedName: item.feed_name || null,
      membershipStatus:
        item.membership_status ||
        item.status ||
        null,
      language: item.language || null,
      region:
        item.primary_region ||
        item.region ||
        null,
      url: item.url || item.download_url || null,
    }));

  return NextResponse.json({
    totalFeeds: objetos.length,
    matches,
  });
}
