import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_ORIGIN = "https://achadosdocasal.com.br";
const LOTES_POR_DIA = 4;

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  return Boolean(segredo && request.headers.get("authorization") === `Bearer ${segredo}`);
}

function indiceLoteAtual() {
  const agora = new Date();
  const horaUtc = agora.getUTCHours();
  if (horaUtc < 8) return 0;
  if (horaUtc < 14) return 1;
  if (horaUtc < 20) return 2;
  return 3;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const { data: radares, error } = await supabaseAdmin
    .from("viagens_radares")
    .select("slug,nome,origem_codigo,destino_codigo")
    .eq("ativo", true)
    .eq("publico", true)
    .contains("tags", ["expansao-20"])
    .order("slug", { ascending: true });

  if (error) {
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  const lista = radares || [];
  const tamanhoLote = Math.max(1, Math.ceil(lista.length / LOTES_POR_DIA));
  const lote = indiceLoteAtual();
  const inicio = lote * tamanhoLote;
  const selecionados = lista.slice(inicio, inicio + tamanhoLote);
  const authorization = request.headers.get("authorization") || "";

  const resultados: Array<Record<string, unknown>> = [];
  let gravadas = 0;
  let erros = 0;

  for (const radar of selecionados) {
    const url = new URL("/api/admin/viagens/radar/executar-expandido", SITE_ORIGIN);
    url.searchParams.set("slug", radar.slug);

    try {
      const resposta = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: authorization },
      });

      const texto = await resposta.text();
      let dados: any = {};
      try {
        dados = texto ? JSON.parse(texto) : {};
      } catch {
        dados = { texto };
      }

      const sucesso = resposta.ok && dados?.sucesso === true;
      const gravadasRadar = Number(dados?.observacoes_gravadas || 0);
      gravadas += gravadasRadar;
      if (!sucesso) erros += 1;

      resultados.push({
        slug: radar.slug,
        origem: radar.origem_codigo,
        destino: radar.destino_codigo,
        sucesso,
        http: resposta.status,
        gravadas: gravadasRadar,
        preco: dados?.preco || null,
        faixa: dados?.faixa || null,
        detalhe: dados?.erro || dados?.status || null,
      });
    } catch (erroExecucao) {
      erros += 1;
      resultados.push({
        slug: radar.slug,
        origem: radar.origem_codigo,
        destino: radar.destino_codigo,
        sucesso: false,
        erro: erroExecucao instanceof Error ? erroExecucao.message : String(erroExecucao),
      });
    }
  }

  return NextResponse.json({
    sucesso: erros === 0,
    lote: lote + 1,
    lotesPorDia: LOTES_POR_DIA,
    radaresExpandidos: lista.length,
    executados: selecionados.length,
    observacoesGravadas: gravadas,
    erros,
    resultados,
    executadoEm: new Date().toISOString(),
  }, { status: erros === 0 ? 200 : 207 });
}
