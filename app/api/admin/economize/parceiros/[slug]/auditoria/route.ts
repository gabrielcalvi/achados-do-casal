import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Config = { slug: string; advertiserId: string };

const CONFIG: Record<string, Config> = {
  cea: { slug: "cea", advertiserId: "17648" },
  renner: { slug: "renner", advertiserId: "70694" },
};

const PUBLISHER_ID = "2922231";

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function auditarLink(link: string | null, advertiserId: string) {
  if (!link) return { afiliadoOk: false, advertiserId: null, publisherId: null, destino: null };
  try {
    const url = new URL(link);
    const mid = url.searchParams.get("awinmid");
    const aff = url.searchParams.get("awinaffid");
    return { afiliadoOk: mid === advertiserId && aff === PUBLISHER_ID, advertiserId: mid, publisherId: aff, destino: url.searchParams.get("ued") };
  } catch {
    return { afiliadoOk: false, advertiserId: null, publisherId: null, destino: null };
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await usuarioAutenticado())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { slug } = await context.params;
    const config = CONFIG[slug];
    if (!config) return NextResponse.json({ error: "Parceiro não suportado." }, { status: 404 });

    const { data: loja, error: erroLoja } = await supabaseAdmin
      .from("economize_lojas")
      .select("id,nome,slug,ativa")
      .eq("slug", config.slug)
      .eq("ativa", true)
      .maybeSingle();
    if (erroLoja) throw erroLoja;
    if (!loja) return NextResponse.json({ advertiserId: config.advertiserId, publisherId: PUBLISHER_ID, ofertas: [], resumo: { total: 0, ativos: 0, afiliadoOk: 0, cliques: 0 } });

    const agora = new Date().toISOString();
    const { data: ofertas, error: erroOfertas } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,status,tipo,titulo,categoria,imagem_url,link_destino,link_afiliado,preco_original,preco_oferta,desconto_percentual,origem,validade,verificado_em,updated_at")
      .eq("loja_id", loja.id)
      .eq("status", "ativo")
      .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
      .or(`validade.is.null,validade.gt.${agora}`)
      .order("desconto_percentual", { ascending: false, nullsFirst: false })
      .limit(100);
    if (erroOfertas) throw erroOfertas;

    const ids = (ofertas || []).map((oferta) => oferta.id);
    const cliquesPorOferta = new Map<string, { total: number; ultimo: string | null; origens: Record<string, number> }>();

    if (ids.length) {
      const { data: cliques, error } = await supabaseAdmin
        .from("economize_cliques")
        .select("oferta_id,origem,clicado_em")
        .in("oferta_id", ids)
        .order("clicado_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      for (const clique of cliques || []) {
        const id = String(clique.oferta_id || "");
        if (!id) continue;
        const item = cliquesPorOferta.get(id) || { total: 0, ultimo: null, origens: {} };
        const origem = String(clique.origem || "desconhecida");
        item.total += 1;
        item.ultimo ||= clique.clicado_em || null;
        item.origens[origem] = (item.origens[origem] || 0) + 1;
        cliquesPorOferta.set(id, item);
      }
    }

    const auditadas = (ofertas || []).map((oferta) => {
      const base = `https://achadosdocasal.com.br/achado/${oferta.id}`;
      return {
        ...oferta,
        publicavel: true,
        auditoria: auditarLink(oferta.link_afiliado, config.advertiserId),
        cliques: cliquesPorOferta.get(oferta.id) || { total: 0, ultimo: null, origens: {} },
        compartilhavel: base,
        whatsapp: `${base}?origem=whatsapp`,
        telegram: `${base}?origem=telegram`,
      };
    });

    return NextResponse.json({
      advertiserId: config.advertiserId,
      publisherId: PUBLISHER_ID,
      loja,
      ofertas: auditadas,
      resumo: {
        total: auditadas.length,
        ativos: auditadas.length,
        afiliadoOk: auditadas.filter((o) => o.auditoria.afiliadoOk).length,
        cliques: auditadas.reduce((soma, o) => soma + o.cliques.total, 0),
      },
    });
  } catch (error) {
    console.error("Erro na auditoria do parceiro AWIN:", error);
    return NextResponse.json({ error: "Não foi possível carregar a auditoria do parceiro." }, { status: 500 });
  }
}
