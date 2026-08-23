import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const JANELA_FRESCOR_MS = 48 * 60 * 60 * 1000;
const LIMITE_POR_EXECUCAO = 1000;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function autorizadoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function autorizado(request: NextRequest) {
  return autorizadoCron(request) || (await usuarioAutenticado());
}

function instanteReferencia(item: {
  verificado_em?: string | null;
  updated_at?: string | null;
  coletado_em?: string | null;
  created_at?: string | null;
}) {
  const candidatos = [item.verificado_em, item.updated_at, item.coletado_em, item.created_at];

  for (const valor of candidatos) {
    if (!valor) continue;
    const tempo = Date.parse(valor);
    if (Number.isFinite(tempo)) return tempo;
  }

  return 0;
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const agora = new Date();
    const agoraIso = agora.toISOString();
    const limiteFrescor = agora.getTime() - JANELA_FRESCOR_MS;

    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,titulo,status,origem,validade,verificado_em,updated_at,coletado_em,created_at,loja:economize_lojas(nome,slug)")
      .in("status", ["ativo", "pendente"])
      .like("origem", "agente_produtos_awin_%")
      .order("verificado_em", { ascending: true, nullsFirst: true })
      .limit(LIMITE_POR_EXECUCAO);

    if (error) throw new Error(`Falha ao carregar catalogo: ${error.message}`);

    const itens = data ?? [];
    const expiradosPorValidade = itens.filter((item) => {
      if (!item.validade) return false;
      const tempo = Date.parse(item.validade);
      return Number.isFinite(tempo) && tempo <= agora.getTime();
    });

    const desatualizados = itens.filter((item) => {
      if (expiradosPorValidade.some((expirado) => expirado.id === item.id)) return false;
      return instanteReferencia(item) < limiteFrescor;
    });

    const idsExpirados = Array.from(new Set([
      ...expiradosPorValidade.map((item) => item.id),
      ...desatualizados.map((item) => item.id),
    ]));

    if (idsExpirados.length > 0) {
      for (let indice = 0; indice < idsExpirados.length; indice += 200) {
        const lote = idsExpirados.slice(indice, indice + 200);
        const { error: erroUpdate } = await supabaseAdmin
          .from("economize_ofertas")
          .update({
            status: "expirado",
            validade: agoraIso,
            destaque: false,
            updated_at: agoraIso,
          })
          .in("id", lote);

        if (erroUpdate) throw new Error(`Falha ao expirar produtos desatualizados: ${erroUpdate.message}`);
      }
    }

    const porOrigem = new Map<string, number>();
    for (const item of desatualizados) {
      const origem = String(item.origem || "desconhecida");
      porOrigem.set(origem, (porOrigem.get(origem) || 0) + 1);
    }

    return NextResponse.json({
      sucesso: true,
      politica: {
        origem: "agente_produtos_awin_*",
        frescorMaximoHoras: JANELA_FRESCOR_MS / 3600000,
        regra: "Produto sem revalidacao dentro da janela sai da vitrine ate ser reencontrado pelo feed oficial.",
      },
      analisados: itens.length,
      expiradosPorValidade: expiradosPorValidade.length,
      expiradosPorDesatualizacao: desatualizados.length,
      totalExpirados: idsExpirados.length,
      porOrigem: Array.from(porOrigem.entries())
        .map(([origem, quantidade]) => ({ origem, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade),
      amostra: desatualizados.slice(0, 20).map((item) => ({
        id: item.id,
        titulo: item.titulo,
        origem: item.origem,
        verificadoEm: item.verificado_em,
      })),
      executadoEm: agoraIso,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Catalogo] Falha na revisao automatica:", error);
    return NextResponse.json({
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro interno.",
    }, { status: 500 });
  }
}
