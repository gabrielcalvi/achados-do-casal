import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_ORIGIN = "https://achadosdocasal.com.br";
const LOTES_POR_DIA = 4;
const CONCORRENCIA = 5;
const LIMITE_MENSAL_IGNAV = 12000;
const ORIGENS_PRIORITARIAS = new Set(["POA", "GRU"]);
const ORIGENS_SEMANAIS = new Set(["BSB"]);

type RadarExpansao = {
  slug: string;
  nome: string;
  origem_codigo: string;
  destino_codigo: string;
};

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

function deveRodarOrigemSemanal(lote: number) {
  const agora = new Date();
  return agora.getUTCDay() === 0 && lote === 0;
}

async function reservarChamada(radar: RadarExpansao) {
  const { data, error } = await supabaseAdmin.rpc("reservar_chamada_ignav", {
    p_limite: LIMITE_MENSAL_IGNAV,
    p_camada: "expansao",
    p_rota: radar.slug,
    p_origem: radar.origem_codigo,
    p_destino: radar.destino_codigo,
  });

  if (error) throw new Error(`Falha ao controlar orçamento Ignav: ${error.message}`);
  return data !== null && data !== undefined;
}

async function executarRadar(radar: RadarExpansao, authorization: string) {
  const reservado = await reservarChamada(radar);
  if (!reservado) {
    return {
      slug: radar.slug,
      origem: radar.origem_codigo,
      destino: radar.destino_codigo,
      prioridade: ORIGENS_PRIORITARIAS.has(radar.origem_codigo),
      sucesso: false,
      gravadas: 0,
      limiteMensalAtingido: true,
      detalhe: `Limite interno de ${LIMITE_MENSAL_IGNAV} chamadas mensais atingido.`,
    };
  }

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

    return {
      slug: radar.slug,
      origem: radar.origem_codigo,
      destino: radar.destino_codigo,
      prioridade: ORIGENS_PRIORITARIAS.has(radar.origem_codigo),
      sucesso,
      http: resposta.status,
      gravadas: Number(dados?.observacoes_gravadas || 0),
      preco: dados?.preco || null,
      faixa: dados?.faixa || null,
      detalhe: dados?.erro || dados?.status || null,
    };
  } catch (erroExecucao) {
    return {
      slug: radar.slug,
      origem: radar.origem_codigo,
      destino: radar.destino_codigo,
      prioridade: ORIGENS_PRIORITARIAS.has(radar.origem_codigo),
      sucesso: false,
      gravadas: 0,
      erro: erroExecucao instanceof Error ? erroExecucao.message : String(erroExecucao),
    };
  }
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
    .order("origem_codigo", { ascending: true })
    .order("destino_codigo", { ascending: true });

  if (error) {
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  const lista = (radares || []) as RadarExpansao[];
  const prioritarios = lista.filter((radar) => ORIGENS_PRIORITARIAS.has(radar.origem_codigo));
  const semanais = lista.filter((radar) => ORIGENS_SEMANAIS.has(radar.origem_codigo));
  const demaisDiarios = lista.filter(
    (radar) => !ORIGENS_PRIORITARIAS.has(radar.origem_codigo) && !ORIGENS_SEMANAIS.has(radar.origem_codigo)
  );

  const lote = indiceLoteAtual();
  const tamanhoLoteDemais = Math.max(1, Math.ceil(demaisDiarios.length / LOTES_POR_DIA));
  const inicio = lote * tamanhoLoteDemais;
  const selecionadosDemais = demaisDiarios.slice(inicio, inicio + tamanhoLoteDemais);
  const selecionadosSemanais = deveRodarOrigemSemanal(lote) ? semanais : [];

  // POA e GRU entram nas quatro rodadas diarias.
  // Brasilia deixa de ser diaria e passa a receber uma rodada semanal.
  // As demais origens continuam divididas em quatro lotes diarios.
  const selecionados = [...prioritarios, ...selecionadosDemais, ...selecionadosSemanais];
  const authorization = request.headers.get("authorization") || "";
  const resultados: Array<Record<string, unknown>> = [];
  let limiteMensalAtingido = false;

  for (let i = 0; i < selecionados.length; i += CONCORRENCIA) {
    if (limiteMensalAtingido) break;

    const grupo = selecionados.slice(i, i + CONCORRENCIA);
    const respostas = await Promise.all(
      grupo.map((radar) => executarRadar(radar, authorization))
    );
    resultados.push(...respostas);

    if (respostas.some((item) => item.limiteMensalAtingido === true)) {
      limiteMensalAtingido = true;
    }
  }

  const gravadas = resultados.reduce((total, item) => total + Number(item.gravadas || 0), 0);
  const erros = resultados.filter((item) => item.sucesso !== true && item.limiteMensalAtingido !== true).length;
  const prioritariosExecutados = resultados.filter((item) => item.prioridade === true).length;

  return NextResponse.json({
    sucesso: erros === 0 && !limiteMensalAtingido,
    limiteMensalIgnav: LIMITE_MENSAL_IGNAV,
    limiteMensalAtingido,
    lote: lote + 1,
    lotesPorDia: LOTES_POR_DIA,
    radaresExpandidos: lista.length,
    origensPrioritarias: ["POA", "GRU"],
    origensSemanais: ["BSB"],
    radaresPrioritarios: prioritarios.length,
    prioritariosExecutados,
    outrosExecutados: resultados.filter((item) => item.prioridade !== true).length,
    planejados: selecionados.length,
    executados: resultados.length,
    concorrencia: CONCORRENCIA,
    observacoesGravadas: gravadas,
    erros,
    resultados,
    executadoEm: new Date().toISOString(),
  }, { status: limiteMensalAtingido ? 429 : erros === 0 ? 200 : 207 });
}
