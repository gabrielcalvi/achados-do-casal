import { NextResponse } from "next/server";
import { buscarMarcaLomadee, buscarProdutosLomadee } from "@/lib/lomadee/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOMES = ["SHEIN", "Shopee", "TeraByte", "Xiaomi", "Brinox", "Mobly"];

export async function GET() {
  const resultados = [] as Array<Record<string, unknown>>;

  for (const nome of NOMES) {
    try {
      const marca = await buscarMarcaLomadee(nome);
      if (!marca) {
        resultados.push({ nome, acessivel: false });
        continue;
      }

      let catalogo = { total: 0, produtos: [] as unknown[] };
      let erroCatalogo: string | null = null;
      try {
        catalogo = await buscarProdutosLomadee(marca.id, 5);
      } catch (erro) {
        erroCatalogo = erro instanceof Error ? erro.message : String(erro);
      }

      resultados.push({
        nome,
        acessivel: true,
        id: marca.id,
        nome_api: marca.name,
        site: marca.site || null,
        comissao: marca.commission || null,
        canais: (marca.channels || []).map((canal) => ({
          nome: canal.name || canal.availableChannel?.name || null,
          shortUrls: canal.shortUrls || [],
        })),
        catalogo_total: catalogo.total,
        catalogo_amostra: (catalogo.produtos as Array<any>).map((produto) => ({
          id: produto.id,
          name: produto.name,
          available: produto.available,
          url: produto.url,
          imagens: produto.images?.slice(0, 2) || [],
          options: produto.options?.slice(0, 2) || [],
        })),
        erro_catalogo: erroCatalogo,
      });
    } catch (erro) {
      resultados.push({ nome, acessivel: false, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  return NextResponse.json({ resultados }, { headers: { "Cache-Control": "no-store" } });
}
