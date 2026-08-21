import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_PERMITIDOS = new Set([7, 30, 90]);

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function percentualVariacao(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function incrementar(mapa: Map<string, number>, chave: string | null | undefined) {
  const normalizada = String(chave || "desconhecido").trim() || "desconhecido";
  mapa.set(normalizada, (mapa.get(normalizada) || 0) + 1);
}

async function buscarOfertas(ids: string[]) {
  const resultado = new Map<string, { id: string; titulo: string; preco_oferta: number | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    if (lote.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,titulo,preco_oferta")
      .in("id", lote);
    if (error) throw new Error(`Falha ao carregar ofertas da performance: ${error.message}`);
    for (const item of data ?? []) resultado.set(item.id, item);
  }
  return resultado;
}

async function buscarLojas(ids: string[]) {
  const resultado = new Map<string, { id: string; nome: string; slug: string }>();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    if (lote.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("economize_lojas")
      .select("id,nome,slug")
      .in("id", lote);
    if (error) throw new Error(`Falha ao carregar lojas da performance: ${error.message}`);
    for (const item of data ?? []) resultado.set(item.id, item);
  }
  return resultado;
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const diasRecebidos = Number(request.nextUrl.searchParams.get("dias") || "30");
    const dias = DIAS_PERMITIDOS.has(diasRecebidos) ? diasRecebidos : 30;
    const agora = new Date();
    const inicioAtual = new Date(agora.getTime() - dias * 86400000);
    const inicioAnterior = new Date(agora.getTime() - dias * 2 * 86400000);

    const { data: cliques, error } = await supabaseAdmin
      .from("economize_cliques")
      .select("oferta_id,loja_id,origem,session_id,clicado_em")
      .gte("clicado_em", inicioAnterior.toISOString())
      .order("clicado_em", { ascending: false })
      .limit(10000);

    if (error) throw new Error(`Falha ao carregar cliques: ${error.message}`);

    const atuais = (cliques ?? []).filter((clique) => new Date(clique.clicado_em).getTime() >= inicioAtual.getTime());
    const anteriores = (cliques ?? []).filter((clique) => {
      const tempo = new Date(clique.clicado_em).getTime();
      return tempo >= inicioAnterior.getTime() && tempo < inicioAtual.getTime();
    });

    const ofertaIds = Array.from(new Set(atuais.map((c) => c.oferta_id).filter(Boolean))) as string[];
    const lojaIds = Array.from(new Set(atuais.map((c) => c.loja_id).filter(Boolean))) as string[];
    const [ofertas, lojas] = await Promise.all([buscarOfertas(ofertaIds), buscarLojas(lojaIds)]);

    const porOrigem = new Map<string, number>();
    const porLoja = new Map<string, number>();
    const porOferta = new Map<string, number>();
    const sessoes = new Set<string>();
    const sessoesAnteriores = new Set<string>();

    for (const clique of atuais) {
      incrementar(porOrigem, clique.origem);
      incrementar(porLoja, clique.loja_id);
      incrementar(porOferta, clique.oferta_id);
      if (clique.session_id) sessoes.add(clique.session_id);
    }
    for (const clique of anteriores) if (clique.session_id) sessoesAnteriores.add(clique.session_id);

    const origens = Array.from(porOrigem.entries())
      .map(([origem, quantidade]) => ({ origem, quantidade, percentual: atuais.length ? Math.round((quantidade / atuais.length) * 1000) / 10 : 0 }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const topLojas = Array.from(porLoja.entries())
      .map(([lojaId, quantidade]) => ({
        lojaId,
        loja: lojas.get(lojaId)?.nome || "Loja não identificada",
        slug: lojas.get(lojaId)?.slug || null,
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    const topOfertas = Array.from(porOferta.entries())
      .map(([ofertaId, quantidade]) => ({
        ofertaId,
        titulo: ofertas.get(ofertaId)?.titulo || "Oferta não identificada",
        preco: ofertas.get(ofertaId)?.preco_oferta ?? null,
        loja: lojas.get(atuais.find((c) => c.oferta_id === ofertaId)?.loja_id || "")?.nome || "Loja",
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    return NextResponse.json({
      periodo: { dias, inicio: inicioAtual.toISOString(), fim: agora.toISOString() },
      resumo: {
        cliques: atuais.length,
        sessoes: sessoes.size,
        cliquesPorSessao: sessoes.size ? Math.round((atuais.length / sessoes.size) * 100) / 100 : 0,
        canaisAtivos: origens.filter((item) => item.quantidade > 0).length,
        variacaoCliques: percentualVariacao(atuais.length, anteriores.length),
        variacaoSessoes: percentualVariacao(sessoes.size, sessoesAnteriores.size),
      },
      origens,
      topLojas,
      topOfertas,
      limiteAmostra: 10000,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro na API de performance:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
