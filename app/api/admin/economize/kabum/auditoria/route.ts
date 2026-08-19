import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADVERTISER_ID = "17729";
const PUBLISHER_ID = "2922231";

async function obterUsuarioAutenticado() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

function auditarLink(link: string | null) {
  if (!link) return { afiliadoOk: false, advertiserId: null, publisherId: null, destino: null };
  try {
    const url = new URL(link);
    const advertiserId = url.searchParams.get("awinmid");
    const publisherId = url.searchParams.get("awinaffid");
    return {
      afiliadoOk: advertiserId === ADVERTISER_ID && publisherId === PUBLISHER_ID,
      advertiserId,
      publisherId,
      destino: url.searchParams.get("ued"),
    };
  } catch {
    return { afiliadoOk: false, advertiserId: null, publisherId: null, destino: null };
  }
}

export async function GET() {
  try {
    const usuario = await obterUsuarioAutenticado();
    if (!usuario) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: loja, error: erroLoja } = await supabaseAdmin
      .from("economize_lojas")
      .select("id,nome,slug,ativa")
      .eq("slug", "kabum")
      .eq("ativa", true)
      .maybeSingle();

    if (erroLoja) throw erroLoja;
    if (!loja) return NextResponse.json({ advertiserId: ADVERTISER_ID, publisherId: PUBLISHER_ID, ofertas: [], resumo: { total: 0, ativos: 0, afiliadoOk: 0, cliques: 0 } });

    const agora = new Date().toISOString();
    const { data: ofertas, error: erroOfertas } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,status,tipo,titulo,categoria,imagem_url,link_destino,link_afiliado,preco_original,preco_oferta,desconto_percentual,origem,validade,verificado_em,updated_at,dados_brutos")
      .eq("loja_id", loja.id)
      .neq("status", "expirado")
      .or(`validade.is.null,validade.gt.${agora}`)
      .order("desconto_percentual", { ascending: false, nullsFirst: false })
      .limit(250);

    if (erroOfertas) throw erroOfertas;

    const ids = (ofertas ?? []).map((oferta) => oferta.id);
    const cliquesPorOferta = new Map<string, { total: number; ultimo: string | null; origens: Record<string, number> }>();

    if (ids.length > 0) {
      const { data: cliques, error: erroCliques } = await supabaseAdmin
        .from("economize_cliques")
        .select("oferta_id,origem,clicado_em")
        .in("oferta_id", ids)
        .order("clicado_em", { ascending: false })
        .limit(10000);
      if (erroCliques) throw erroCliques;

      for (const clique of cliques ?? []) {
        const ofertaId = String(clique.oferta_id || "");
        if (!ofertaId) continue;
        const atual = cliquesPorOferta.get(ofertaId) || { total: 0, ultimo: null, origens: {} };
        const origem = String(clique.origem || "desconhecida");
        atual.total += 1;
        atual.ultimo = atual.ultimo || clique.clicado_em || null;
        atual.origens[origem] = (atual.origens[origem] || 0) + 1;
        cliquesPorOferta.set(ofertaId, atual);
      }
    }

    const auditadas = (ofertas ?? []).map((oferta) => {
      const publicavel = oferta.status === "ativo" && (!oferta.validade || new Date(oferta.validade).getTime() > Date.now());
      const base = publicavel ? `https://achadosdocasal.com.br/achado/${oferta.id}` : null;
      return {
        ...oferta,
        publicavel,
        auditoria: auditarLink(oferta.link_afiliado),
        cliques: cliquesPorOferta.get(oferta.id) || { total: 0, ultimo: null, origens: {} },
        compartilhavel: base,
        whatsapp: base ? `${base}?origem=whatsapp` : null,
        telegram: base ? `${base}?origem=telegram` : null,
      };
    });

    return NextResponse.json({
      advertiserId: ADVERTISER_ID,
      publisherId: PUBLISHER_ID,
      loja,
      ofertas: auditadas,
      resumo: {
        total: auditadas.length,
        ativos: auditadas.filter((oferta) => oferta.publicavel).length,
        afiliadoOk: auditadas.filter((oferta) => oferta.auditoria.afiliadoOk).length,
        cliques: auditadas.reduce((soma, oferta) => soma + oferta.cliques.total, 0),
      },
    });
  } catch (error) {
    console.error("Erro na auditoria KaBuM/AWIN:", error);
    return NextResponse.json({ error: "Não foi possível carregar a auditoria KaBuM/AWIN." }, { status: 500 });
  }
}
