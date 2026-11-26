import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfiguracaoParceiro = {
  slug: string;
  nome: string;
  href: string;
  tema: string;
};

type LojaRelacionada = {
  id?: string;
  nome?: string;
  slug?: string;
  ativa?: boolean;
  segmento?: string;
};

type OfertaParceiro = {
  id: string;
  loja: LojaRelacionada | LojaRelacionada[] | null;
};

const PARCEIROS_COM_VITRINE: ConfiguracaoParceiro[] = [
  { slug: "cobasi", nome: "Cobasi", href: "/cobasi", tema: "cobasi" },
  { slug: "cea", nome: "C&A", href: "/cea", tema: "cea" },
  { slug: "kabum", nome: "KaBuM!", href: "/kabum", tema: "kabum" },
  { slug: "nike", nome: "Nike", href: "/nike", tema: "nike" },
  { slug: "terabyte", nome: "TeraByte", href: "/terabyte", tema: "terabyte" },
];

function normalizarLoja(
  loja: LojaRelacionada | LojaRelacionada[] | null,
): LojaRelacionada | null {
  if (Array.isArray(loja)) return loja[0] ?? null;
  return loja ?? null;
}

export async function GET() {
  try {
    const agora = new Date().toISOString();
    const slugs = PARCEIROS_COM_VITRINE.map((parceiro) => parceiro.slug);

    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .select(
        "id,loja:economize_lojas!inner(id,nome,slug,ativa,segmento)",
      )
      .eq("status", "ativo")
      .eq("economize_lojas.ativa", true)
      .eq("economize_lojas.segmento", "varejo")
      .in("economize_lojas.slug", slugs)
      .not("link_afiliado", "is", null)
      .neq("link_afiliado", "")
      .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
      .or(`validade.is.null,validade.gt.${agora}`)
      .limit(2500);

    if (error) {
      console.error("Erro ao calcular parceiros com ofertas:", error);
      return NextResponse.json(
        { error: "Não foi possível carregar os parceiros." },
        { status: 500 },
      );
    }

    const contagem = new Map<string, number>();

    for (const oferta of (data ?? []) as OfertaParceiro[]) {
      const loja = normalizarLoja(oferta.loja);
      if (!loja?.slug) continue;
      contagem.set(loja.slug, (contagem.get(loja.slug) ?? 0) + 1);
    }

    const parceiros = PARCEIROS_COM_VITRINE
      .map((parceiro) => ({
        ...parceiro,
        quantidade: contagem.get(parceiro.slug) ?? 0,
      }))
      .filter(
        (parceiro) =>
          parceiro.quantidade >= 5 ||
          (parceiro.slug === "terabyte" && parceiro.quantidade > 0),
      );

    return NextResponse.json(
      {
        parceiros,
        total: parceiros.length,
        atualizadoEm: agora,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado ao carregar parceiros:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar os parceiros." },
      { status: 500 },
    );
  }
}
