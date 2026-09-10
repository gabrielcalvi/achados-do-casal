import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARCAS = [
  { nome: "Renner", advertiserId: 70694 },
  { nome: "Calvin Klein", advertiserId: 100553 },
  { nome: "Stanley", advertiserId: 30599 },
  { nome: "Nike", advertiserId: 17652 },
  { nome: "Casas Bahia", advertiserId: 17629 },
];

async function consultar(token: string, publisherId: number, advertiserId: number, type: "voucher" | "promotion") {
  const resposta = await fetch(`https://api.awin.com/publisher/${publisherId}/promotions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filters: {
        advertiserIds: [advertiserId],
        membership: "joined",
        regionCodes: ["BR"],
        status: "active",
        type,
      },
      pagination: { page: 1, pageSize: 20 },
    }),
    cache: "no-store",
  });

  const texto = await resposta.text();
  let json: any = null;
  try { json = JSON.parse(texto); } catch {}

  if (!resposta.ok) {
    return { ok: false, status: resposta.status, erro: json?.description || json?.message || texto.slice(0, 200) };
  }

  const itens = Array.isArray(json?.data) ? json.data : [];
  return {
    ok: true,
    total: json?.pagination?.total ?? itens.length,
    amostra: itens.slice(0, 5).map((item: any) => ({
      promotionId: item?.promotionId ?? null,
      title: item?.title ?? null,
      type: item?.type ?? null,
      code: item?.voucher?.code ?? null,
      startDate: item?.startDate ?? null,
      endDate: item?.endDate ?? null,
      joined: item?.advertiser?.joined ?? null,
      advertiserId: item?.advertiser?.id ?? null,
      url: item?.url ?? null,
      temTracking: Boolean(item?.urlTracking),
    })),
  };
}

export async function GET() {
  const token = process.env.AWIN_API_TOKEN?.trim();
  const publisherId = Number(process.env.AWIN_PUBLISHER_ID || 2922231);
  if (!token) return NextResponse.json({ sucesso: false, erro: "AWIN_API_TOKEN ausente." }, { status: 500 });

  const resultados = [];
  for (const marca of MARCAS) {
    const [vouchers, promocoes] = await Promise.all([
      consultar(token, publisherId, marca.advertiserId, "voucher"),
      consultar(token, publisherId, marca.advertiserId, "promotion"),
    ]);
    resultados.push({ ...marca, vouchers, promocoes });
  }

  return NextResponse.json({ sucesso: true, publisherId, resultados }, { headers: { "Cache-Control": "no-store" } });
}
