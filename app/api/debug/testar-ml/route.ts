import { NextResponse } from "next/server";
import { extrairProduto } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TESTES = {
  catalogo:
    "https://www.mercadolivre.com.br/p/MLB26264031?matt_tool=38524122&pdp_filters=item_id:MLB5982398014&ua=42KcEQXIE2GA0k4kB0RnrMHoRWBJJpjTKNUd5fJv6vxi-kI#origin=share&sid=share&wid=MLB5982398014&action=whatsapp",
  userProduct:
    "https://www.mercadolivre.com.br/kit-saude-oral-virbac-pasta-cet-com-necessaire-e-escova-sabor-frango/up/MLBU749693303",
  realComWid:
    "https://www.mercadolivre.com.br/kit-pa--enxada-antifaiscante-plastica-cabo-de-madeira-50cm/up/MLBU3388038385?pdp_filters=price%3A*-45#polycard_client=search-desktop&be_origin=backend&overlay_label=not_apply&search_layout=grid&position=58&type=product&tracking_id=0270a58f-d59f-4cd0-9888-ab256e1bc161&wid=MLB5652208776&sid=search",
};

export async function GET() {
  const resultados: Record<string, unknown> = {};

  for (const [nome, link] of Object.entries(TESTES)) {
    const inicio = Date.now();

    try {
      resultados[nome] = {
        sucesso: true,
        duracaoMs: Date.now() - inicio,
        dados: await extrairProduto(link),
      };
    } catch (error) {
      resultados[nome] = {
        sucesso: false,
        duracaoMs: Date.now() - inicio,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json(resultados);
}
