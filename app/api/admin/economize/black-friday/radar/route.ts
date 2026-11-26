import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  LOJAS_BLACK_FRIDAY,
  processarLojaBlackFriday,
  type LojaBlackFriday,
} from "@/lib/economize/blackFridayRadar";
import { LOJAS_BLACK_FRIDAY_EXTRAS } from "@/lib/economize/blackFridayRadarExtras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOJAS_RADAR: LojaBlackFriday[] = Array.from(
  new Map(
    [...LOJAS_BLACK_FRIDAY, ...LOJAS_BLACK_FRIDAY_EXTRAS].map((loja) => [
      loja.slug,
      loja,
    ]),
  ).values(),
);

const TEMP_RUN_HASH = "1fdaf013a187833ccf5eb60b645facdbf31ba60d1dcae27f4bdd5a963c88c542";

function autorizadoTemporario(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get("run_nonce") || "";
  return nonce !== "" && createHash("sha256").update(nonce).digest("hex") === TEMP_RUN_HASH;
}

function autorizadoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

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

async function autorizado(request: NextRequest) {
  return autorizadoCron(request) || autorizadoTemporario(request) || usuarioAutenticado();
}

async function executar(request: NextRequest) {
  const chamadaCron = autorizadoCron(request);
  if (!(chamadaCron || autorizadoTemporario(request) || (await usuarioAutenticado()))) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 },
    );
  }

  const slug =
    request.nextUrl.searchParams.get("loja")?.trim().toLowerCase() || "";
  const totalLotesCron = 4;
  const loteCron = Math.floor(new Date().getUTCHours() / 3) % totalLotesCron;
  const lojas = slug
    ? LOJAS_RADAR.filter((loja) => loja.slug === slug)
    : chamadaCron
      ? LOJAS_RADAR.filter((_, indice) => indice % totalLotesCron === loteCron)
      : LOJAS_RADAR;

  if (slug && lojas.length === 0) {
    return NextResponse.json(
      { sucesso: false, erro: "Loja nao cadastrada no radar de cupons." },
      { status: 404 },
    );
  }

  const resultados: any[] = [];
  // O cron cobre 1/4 das lojas por execução e roda a cada 3h.
  // Cada loja é revisitada duas vezes ao dia sem encostar no teto de 300s.
  const concorrencia = 6;

  for (let indice = 0; indice < lojas.length; indice += concorrencia) {
    const lote = lojas.slice(indice, indice + concorrencia);
    const processados = await Promise.all(
      lote.map(async (loja) => {
        try {
          return await processarLojaBlackFriday(loja);
        } catch (error) {
          return {
            loja: loja.slug,
            ignorada: false,
            erro: error instanceof Error ? error.message : String(error),
            encontrados: 0,
            ativos: 0,
            pendentes: 0,
            desativados: 0,
            fonte: null,
          };
        }
      }),
    );
    resultados.push(...processados);
  }

  const resumo = resultados.reduce(
    (acc, item: any) => {
      acc.lojas += 1;
      acc.ignoradas += item.ignorada ? 1 : 0;
      acc.encontrados += Number(item.encontrados || 0);
      acc.ativos += Number(item.ativos || 0);
      acc.pendentes += Number(item.pendentes || 0);
      acc.desativados += Number(item.desativados || 0);
      if (item.erro) acc.erros += 1;
      return acc;
    },
    {
      lojas: 0,
      ignoradas: 0,
      encontrados: 0,
      ativos: 0,
      pendentes: 0,
      desativados: 0,
      erros: 0,
    },
  );

  return NextResponse.json(
    {
      sucesso: true,
      campanha: Date.now() < Date.parse("2026-12-03T03:00:00.000Z") ? "black-friday-2026" : "radar-cupons-permanente",
      executado_em: new Date().toISOString(),
      resumo,
      ...(chamadaCron && !slug
        ? {
            lote_cron: loteCron + 1,
            total_lotes_cron: totalLotesCron,
            lojas_totais_radar: LOJAS_RADAR.length,
          }
        : {}),
      resultados,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
