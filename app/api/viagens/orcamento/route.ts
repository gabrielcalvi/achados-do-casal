import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NOMES_DESTINOS: Record<string, string> = {
  ORL: "Orlando",
  MIA: "Miami",
  NYC: "Nova York",
  LAX: "Los Angeles",
  LIS: "Lisboa",
  MAD: "Madrid",
};

function classificar(preco: number, radar: Record<string, any>) {
  const excelente = Number(radar.preco_excelente_ate);
  const muitoBom = Number(radar.preco_muito_bom_ate);
  const interessante = Number(radar.preco_interessante_ate);
  const comum = Number(radar.preco_comum_ate);

  if (Number.isFinite(excelente) && preco <= excelente) return "Achado Absurdo";
  if (Number.isFinite(muitoBom) && preco <= muitoBom) return "Preço muito bom";
  if (Number.isFinite(interessante) && preco <= interessante) return "Interessante";
  if (Number.isFinite(comum) && preco <= comum) return "Faixa comum";
  return "Acima da faixa ideal";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origem = String(url.searchParams.get("origem") || "POA").trim().toUpperCase();
  const orcamento = Number(url.searchParams.get("orcamento") || 10000);
  const viajantes = Math.min(9, Math.max(1, Number(url.searchParams.get("viajantes") || 2)));

  if (!Number.isFinite(orcamento) || orcamento <= 0) {
    return NextResponse.json({ sucesso: false, erro: "Orçamento inválido." }, { status: 400 });
  }

  const desde = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const { data: radares, error: erroRadares } = await supabaseAdmin
    .from("viagens_radares")
    .select(
      "id,nome,slug,origem_codigo,destino_codigo,destino_cidade,destino_pais,preco_excelente_ate,preco_muito_bom_ate,preco_interessante_ate,preco_comum_ate,prioridade"
    )
    .eq("ativo", true)
    .eq("publico", true)
    .eq("origem_codigo", origem);

  if (erroRadares) {
    return NextResponse.json({ sucesso: false, erro: erroRadares.message }, { status: 500 });
  }

  const ids = (radares || []).map((radar) => radar.id);
  if (ids.length === 0) {
    return NextResponse.json({ sucesso: true, origem, orcamento, viajantes, resultados: [] });
  }

  const { data: precos, error: erroPrecos } = await supabaseAdmin
    .from("viagens_precos")
    .select(
      "id,radar_id,preco_por_pessoa,preco_total,ida,volta,permanencia_dias,cia_aerea,escalas_ida,escalas_volta,faixa,score,link_compra,link_afiliado,observado_em"
    )
    .in("radar_id", ids)
    .gte("observado_em", desde)
    .gt("preco_por_pessoa", 0)
    .order("preco_por_pessoa", { ascending: true })
    .limit(600);

  if (erroPrecos) {
    return NextResponse.json({ sucesso: false, erro: erroPrecos.message }, { status: 500 });
  }

  const melhorPorRadar = new Map<string, Record<string, any>>();
  for (const preco of precos || []) {
    if (!melhorPorRadar.has(preco.radar_id)) melhorPorRadar.set(preco.radar_id, preco);
  }

  const resultados = (radares || [])
    .map((radar) => {
      const preco = melhorPorRadar.get(radar.id);
      if (!preco) return null;

      const porPessoa = Number(preco.preco_por_pessoa);
      const totalPassagens = porPessoa * viajantes;
      const sobra = orcamento - totalPassagens;
      const percentualOrcamento = (totalPassagens / orcamento) * 100;

      return {
        radarId: radar.id,
        slug: radar.slug,
        destinoCodigo: radar.destino_codigo,
        destino: radar.destino_cidade || NOMES_DESTINOS[radar.destino_codigo] || radar.destino_codigo,
        precoPorPessoa: porPessoa,
        totalPassagens,
        sobra,
        cabeNoOrcamento: sobra >= 0,
        percentualOrcamento,
        classificacao: classificar(porPessoa, radar),
        ida: preco.ida,
        volta: preco.volta,
        permanenciaDias: preco.permanencia_dias,
        ciaAerea: preco.cia_aerea,
        escalasIda: preco.escalas_ida,
        escalasVolta: preco.escalas_volta,
        score: preco.score,
        link: preco.link_afiliado || preco.link_compra || null,
        observadoEm: preco.observado_em,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a!.cabeNoOrcamento !== b!.cabeNoOrcamento) return a!.cabeNoOrcamento ? -1 : 1;
      return b!.sobra - a!.sobra;
    });

  return NextResponse.json({
    sucesso: true,
    origem,
    orcamento,
    viajantes,
    resultados,
    aviso: "Esta primeira versão compara o orçamento com as passagens encontradas pelo Radar. Hospedagem e demais custos serão adicionados na próxima camada.",
  });
}
