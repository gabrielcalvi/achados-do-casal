export const dynamic = "force-static";

const PUBLISHER = 2922231;
const ADVERTISER = 70694;

export default async function RennerOffersBuildPage() {
  try {
    const token = process.env.AWIN_API_TOKEN;
    if (!token) throw new Error("AWIN_API_TOKEN ausente");

    const resposta = await fetch(`https://api.awin.com/publisher/${PUBLISHER}/promotions?accessToken=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        filters: {
          advertiserIds: [ADVERTISER],
          membership: "joined",
          regionCodes: ["BR"],
          status: "active",
          type: "all"
        },
        pagination: { page: 1, pageSize: 200 }
      }),
      signal: AbortSignal.timeout(60000),
    });

    const corpo = await resposta.text();
    let json: unknown = corpo;
    try { json = JSON.parse(corpo); } catch {}
    console.log("[AWIN RENNER OFFERS]", JSON.stringify({ status: resposta.status, resposta: json }));
  } catch (erro) {
    console.log("[AWIN RENNER OFFERS ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Diagnóstico Offers API Renner.</main>;
}
