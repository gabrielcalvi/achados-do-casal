import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  amazonCreatorsConfigurado,
  pesquisarItensAmazon,
} from "@/lib/amazon/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function numeroInteiro(valor: string | null, padrao: number) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.trunc(numero) : padrao;
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  if (!amazonCreatorsConfigurado()) {
    return NextResponse.json({
      sucesso: true,
      configurado: false,
      marketplace: "www.amazon.com.br",
      publicacaoAutomatica: false,
      variaveisNecessarias: [
        "AMAZON_CREATORS_CLIENT_ID",
        "AMAZON_CREATORS_CLIENT_SECRET",
        "AMAZON_CREATORS_CREDENTIAL_VERSION",
        "AMAZON_ASSOCIATE_TAG",
      ],
    });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "ofertas";
  const itemCount = numeroInteiro(
    request.nextUrl.searchParams.get("itemCount"),
    5
  );
  const minSavingPercent = numeroInteiro(
    request.nextUrl.searchParams.get("minSavingPercent"),
    10
  );

  try {
    const resultado = await pesquisarItensAmazon({
      keywords: q,
      itemCount,
      minSavingPercent,
    });

    const itens = resultado.items.map((item) => {
      const oferta = item.offersV2?.listings?.[0];

      return {
        asin: item.asin || null,
        titulo: item.itemInfo?.title?.displayValue || null,
        imagem: item.images?.primary?.medium?.url || null,
        urlAfiliada: item.detailPageURL || null,
        preco: oferta?.price?.money?.amount ?? null,
        moeda: oferta?.price?.money?.currency || null,
        precoOriginal: oferta?.price?.savingBasis?.money?.amount ?? null,
        economia: oferta?.price?.savings?.money?.amount ?? null,
        economiaPercentual: oferta?.price?.savings?.percentage ?? null,
        disponibilidade: oferta?.availability?.type || null,
        deal: oferta?.dealDetails
          ? {
              badge: oferta.dealDetails.badge || null,
              acesso: oferta.dealDetails.accessType || null,
              inicio: oferta.dealDetails.startTime || null,
              fim: oferta.dealDetails.endTime || null,
              percentualResgatado:
                oferta.dealDetails.percentClaimed ?? null,
            }
          : null,
        vendedor: oferta?.merchantInfo?.name || null,
        tipoOferta: oferta?.type || null,
      };
    });

    return NextResponse.json({
      sucesso: true,
      configurado: true,
      marketplace: resultado.marketplace,
      publicacaoAutomatica: false,
      consulta: {
        q,
        itemCount,
        minSavingPercent,
      },
      totalResultadoAmazon: resultado.totalResultCount,
      totalRetornado: itens.length,
      itens,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        configurado: true,
        erro: erro instanceof Error ? erro.message : "Erro inesperado.",
      },
      { status: 502 }
    );
  }
}
