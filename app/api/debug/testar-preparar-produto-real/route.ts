import { NextResponse } from "next/server";
import { POST as prepararProduto } from "@/app/api/preparar-produto/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LINK = "https://www.mercadolivre.com.br/kit-pa--enxada-antifaiscante-plastica-cabo-de-madeira-50cm/up/MLBU3388038385?pdp_filters=price%3A*-45#polycard_client=search-desktop&be_origin=backend&overlay_label=not_apply&search_layout=grid&position=58&type=product&tracking_id=0270a58f-d59f-4cd0-9888-ab256e1bc161&wid=MLB5652208776&sid=search";

export async function GET() {
  const request = new Request("https://achadosdocasal.com.br/api/preparar-produto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link: LINK }),
  });

  const resposta = await prepararProduto(request);
  const corpo = await resposta.json();

  return NextResponse.json(
    {
      statusPreparar: resposta.status,
      corpo,
    },
    { status: 200 }
  );
}
