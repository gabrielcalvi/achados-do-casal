import { NextResponse } from "next/server";
import {
  buscarGaleriaMercadoLivreZenRows,
  zenRowsGaleriaConfigurada,
} from "@/lib/mercadolivre/zenRowsGallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK = "https://www.mercadolivre.com.br/kit-pa--enxada-antifaiscante-plastica-cabo-de-madeira-50cm/up/MLBU3388038385?pdp_filters=price%3A*-45#polycard_client=search-desktop&be_origin=backend&overlay_label=not_apply&search_layout=grid&position=58&type=product&tracking_id=0270a58f-d59f-4cd0-9888-ab256e1bc161&wid=MLB5652208776&sid=search";

export async function GET() {
  const configurada = zenRowsGaleriaConfigurada();

  if (!configurada) {
    return NextResponse.json({ configurada: false, total: 0, imagens: [] });
  }

  try {
    const imagens = await buscarGaleriaMercadoLivreZenRows(LINK);
    return NextResponse.json({
      configurada: true,
      total: imagens.length,
      imagens,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configurada: true,
        total: 0,
        imagens: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
