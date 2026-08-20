import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IGNAV_BASE_URL = "https://ignav.com/api";
const PERMANENCIAS = [8, 12, 15] as const;
const DIAS_PREFERIDOS = [4, 8, 12, 16, 20, 24, 28] as const;
const HORIZONTE_MESES = 10;

const DESTINO_PROVIDER: Record<string, string> = {
  ORL: "MCO",
  NYC: "JFK",
  MIA: "MIA",
  LAX: "LAX",
  LIS: "LIS",
  MAD: "MAD",
  CDG: "CDG",
  LHR: "LHR",
  FCO: "FCO",
  BCN: "BCN",
  AMS: "AMS",
  MXP: "MXP",
  LAS: "LAS",
  SFO: "SFO",
  CUN: "CUN",
  PUJ: "PUJ",
  EZE: "EZE",
  SCL: "SCL",
  NRT: "NRT",
  DXB: "DXB",
};

type Radar = {
  id: string;
  slug: string;
  nome: string;
  origem_codigo: string;
  destino_codigo: string;
  preco_excelente_ate: number | null;
  preco_muito_bom_ate: number | null;
  preco_interessante_ate: number | null;
  preco_comum_ate: number | null;
};

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  return Boolean(segredo && request.headers.get("authorization") === `Bearer ${segredo}`);
}

function hashTexto(texto: string) {
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dataIso(data: Date) {
  return data.toISOString().slice(0, 10);
}

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data.getTime());
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function escolherJanela(slug: string) {
  const agora = new Date();
  const janelaSeisHoras = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  const hash = hashTexto(slug);
  const deslocamentoMes = 1 + ((hash + janelaSeisHoras) % HORIZONTE_MESES);
  const diaPreferido = DIAS_PREFERIDOS[(hash + janelaSeisHoras) % DIAS_PREFERIDOS.length];
  const permanencia = PERMANENCIAS[(hash + janelaSeisHoras) % PERMANENCIAS.length];

  const primeiroDiaMes = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + deslocamentoMes, 1)
  );
  const ultimoDia = new Date(
    Date.UTC(primeiroDiaMes.getUTCFullYear(), primeiroDiaMes.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const dia = Math.min(diaPreferido, ultimoDia);
  const ida = new Date(
    Date.UTC(primeiroDiaMes.getUTCFullYear(), primeiroDiaMes.getUTCMonth(), dia)
  );
  const volta = adicionarDias(ida, permanencia);

  return {
    ida: dataIso(ida),
    volta: dataIso(volta),
    permanencia,
  };
}

function classificar(radar: Radar, preco: number) {
  const excelente = Number(radar.preco_excelente_ate);
  const muitoBom = Number(radar.preco_muito_bom_ate);
  const interessante = Number(radar.preco_interessante_ate);
  const comum = Number(radar.preco_comum_ate);

  if (excelente > 0 && preco <= excelente) {
    return { faixa: "achado_absurdo", prioridade: 4 };
  }
  if (muitoBom > 0 && preco <= muitoBom) {
    return { faixa: "preco_bom", prioridade: 3 };
  }
  if (interessante > 0 && preco <= interessante) {
    return { faixa: "interessante", prioridade: 2 };
  }
  if (comum > 0 && preco <= comum) {
    return { faixa: "preco_comum", prioridade: 1 };
  }
  return { faixa: "nao_promocao", prioridade: 0 };
}

function media(valores: number[]) {
  if (!valores.length) return null;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

function companhiaPrincipal(itinerario: any) {
  return (
    itinerario?.outbound?.carrier ||
    itinerario?.outbound?.segments?.[0]?.operating_carrier_name ||
    itinerario?.outbound?.segments?.[0]?.marketing_carrier_code ||
    null
  );
}

function codigoCompanhia(itinerario: any) {
  return itinerario?.outbound?.segments?.[0]?.marketing_carrier_code || null;
}

function numeroEscalas(perna: any) {
  const segmentos = Array.isArray(perna?.segments) ? perna.segments : [];
  return segmentos.length ? Math.max(0, segmentos.length - 1) : null;
}

function bagagemIncluida(itinerario: any) {
  const bags = itinerario?.bags || {};
  const despachada = Number(bags?.checked || 0);
  const mao = Number(bags?.carry_on || 0);
  return despachada > 0 || mao > 0 ? true : null;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ sucesso: false, erro: "Informe o slug do radar." }, { status: 400 });
  }

  const ignavKey = process.env.IGNAV_API_KEY?.trim();
  if (!ignavKey) {
    return NextResponse.json({ sucesso: false, erro: "IGNAV_API_KEY nao configurada." }, { status: 500 });
  }

  const { data: radar, error: erroRadar } = await supabaseAdmin
    .from("viagens_radares")
    .select(
      "id,slug,nome,origem_codigo,destino_codigo,preco_excelente_ate,preco_muito_bom_ate,preco_interessante_ate,preco_comum_ate"
    )
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (erroRadar || !radar) {
    return NextResponse.json(
      { sucesso: false, erro: erroRadar?.message || "Radar nao encontrado." },
      { status: 404 }
    );
  }

  const radarTipado = radar as Radar;
  const destinoProvider = DESTINO_PROVIDER[radarTipado.destino_codigo];
  if (!destinoProvider) {
    return NextResponse.json(
      { sucesso: false, erro: `Destino ${radarTipado.destino_codigo} ainda sem mapeamento de provider.` },
      { status: 400 }
    );
  }

  const janela = escolherJanela(radarTipado.slug);

  try {
    const resposta = await fetch(`${IGNAV_BASE_URL}/fares/round-trip`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-Api-Key": ignavKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: radarTipado.origem_codigo,
        destination: destinoProvider,
        departure_date: janela.ida,
        return_date: janela.volta,
        adults: 1,
        cabin_class: "economy",
        market: "BR",
        max_stops: 1,
        allow_self_transfer: false,
      }),
    });

    const texto = await resposta.text();
    let dados: any = {};
    try {
      dados = texto ? JSON.parse(texto) : {};
    } catch {
      dados = { texto };
    }

    if (!resposta.ok) {
      throw new Error(
        `Ignav HTTP ${resposta.status}: ${dados?.message || dados?.error || dados?.detail || "erro sem detalhe"}`
      );
    }

    const itinerarios = Array.isArray(dados?.itineraries) ? dados.itineraries : [];
    const ofertas = itinerarios
      .map((item: any) => ({
        item,
        preco: Number(item?.price?.amount),
        status: item?.price?.status || null,
      }))
      .filter((item: { preco: number }) => Number.isFinite(item.preco) && item.preco > 0)
      .sort((a: { preco: number }, b: { preco: number }) => a.preco - b.preco);

    const verificadas = ofertas.filter((oferta: { status: string | null }) => oferta.status === "verified");
    const melhor = (verificadas.length ? verificadas : ofertas)[0];

    if (!melhor) {
      return NextResponse.json({
        sucesso: true,
        slug,
        consultas: 1,
        observacoes_gravadas: 0,
        status: "sem_ofertas",
        janela,
      });
    }

    const preco = Number(melhor.preco);
    const itinerario = melhor.item;

    const { data: historico } = await supabaseAdmin
      .from("viagens_precos")
      .select("preco_por_pessoa")
      .eq("radar_id", radarTipado.id)
      .gt("preco_por_pessoa", 0)
      .order("observado_em", { ascending: false })
      .limit(120);

    const valoresHistoricos = (historico || [])
      .map((item) => Number(item.preco_por_pessoa))
      .filter((valor) => Number.isFinite(valor) && valor > 0);
    const mediaHistorica = media(valoresHistoricos);
    const percentualAbaixoMedia =
      mediaHistorica && mediaHistorica > 0
        ? ((mediaHistorica - preco) / mediaHistorica) * 100
        : null;

    const classificacao = classificar(radarTipado, preco);
    let score = classificacao.prioridade * 20;
    if (percentualAbaixoMedia !== null && percentualAbaixoMedia > 0) {
      score += Math.min(20, percentualAbaixoMedia);
    }

    const companhia = companhiaPrincipal(itinerario);
    const codigo = codigoCompanhia(itinerario);
    const escalasIda = numeroEscalas(itinerario?.outbound);
    const escalasVolta = numeroEscalas(itinerario?.inbound);

    const { error: erroInsert } = await supabaseAdmin.from("viagens_precos").insert({
      radar_id: radarTipado.id,
      provider: "ignav",
      provider_offer_id: itinerario?.ignav_id || itinerario?.id || null,
      tipo_preco: "live",
      origem_codigo: radarTipado.origem_codigo,
      destino_codigo: radarTipado.destino_codigo,
      ida: janela.ida,
      volta: janela.volta,
      permanencia_dias: janela.permanencia,
      adultos: 1,
      criancas: 0,
      bebes: 0,
      cabine: "economica",
      moeda: itinerario?.price?.currency || "BRL",
      preco_por_pessoa: preco,
      preco_total: preco,
      taxas_incluidas: true,
      cia_aerea: companhia,
      cia_aerea_codigo: codigo,
      escalas_ida: escalasIda,
      escalas_volta: escalasVolta,
      duracao_ida_minutos: Number(itinerario?.outbound?.duration_minutes) || null,
      duracao_volta_minutos: Number(itinerario?.inbound?.duration_minutes) || null,
      bagagem_incluida: bagagemIncluida(itinerario),
      faixa: classificacao.faixa,
      score: Number(score.toFixed(2)),
      media_historica: mediaHistorica,
      percentual_abaixo_media:
        percentualAbaixoMedia === null ? null : Number(percentualAbaixoMedia.toFixed(2)),
      dados_brutos: {
        fonte: "ignav",
        automatico: true,
        camada: "expansao_destinos",
        companhia,
        bagagem: itinerario?.bags || null,
        status_preco: melhor.status,
        self_transfer: Boolean(itinerario?.requires_self_transfer),
        itinerario,
      },
    });

    if (erroInsert) {
      throw new Error(`Erro ao gravar preco: ${erroInsert.message}`);
    }

    return NextResponse.json({
      sucesso: true,
      slug,
      consultas: 1,
      observacoes_gravadas: 1,
      erros: 0,
      janela,
      preco,
      faixa: classificacao.faixa,
      companhia,
      executadoEm: new Date().toISOString(),
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[Radar expandido]", slug, mensagem);

    return NextResponse.json(
      {
        sucesso: false,
        slug,
        consultas: 1,
        observacoes_gravadas: 0,
        erros: 1,
        erro: mensagem,
        janela,
      },
      { status: 502 }
    );
  }
}
