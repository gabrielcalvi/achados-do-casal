import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BLACK_FRIDAY_FIM,
  LOJAS_BLACK_FRIDAY,
  processarLojaBlackFriday,
} from "@/lib/economize/blackFridayRadar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizadoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(request: NextRequest) {
  return autorizadoCron(request) || usuarioAutenticado();
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  if (Date.now() >= Date.parse(BLACK_FRIDAY_FIM)) {
    return NextResponse.json({
      sucesso: true,
      campanha: "black-friday-2026",
      encerrada: true,
      mensagem: "Radar Black Friday encerrado.",
    });
  }

  const slug = request.nextUrl.searchParams.get("loja")?.trim().toLowerCase() || "";
  const lojas = slug
    ? LOJAS_BLACK_FRIDAY.filter((loja) => loja.slug === slug)
    : LOJAS_BLACK_FRIDAY;

  if (slug && lojas.length === 0) {
    return NextResponse.json(
      { sucesso: false, erro: "Loja nao cadastrada no radar Black Friday." },
      { status: 404 }
    );
  }

  const resultados: any[] = [];
  const concorrencia = 4;

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
      })
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
    { lojas: 0, ignoradas: 0, encontrados: 0, ativos: 0, pendentes: 0, desativados: 0, erros: 0 }
  );

  return NextResponse.json(
    {
      sucesso: true,
      campanha: "black-friday-2026",
      executado_em: new Date().toISOString(),
      resumo,
      resultados,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
