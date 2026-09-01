import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Estado = "ok" | "atencao" | "erro";
type Check = {
  chave: string;
  titulo: string;
  status: Estado;
  mensagem: string;
  metricas: Record<string, unknown>;
  recuperar?: string;
};

function autorizadoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
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

function horasDesde(valor: string | null | undefined) {
  if (!valor) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - ms) / 3_600_000);
}

async function contarProdutosAwin(slug: string) {
  const origem = `agente_produtos_awin_${slug}`;
  const [ativosResp, pendentesResp, ultimaResp] = await Promise.all([
    supabaseAdmin
      .from("economize_ofertas")
      .select("id", { count: "exact", head: true })
      .eq("origem", origem)
      .eq("status", "ativo"),
    supabaseAdmin
      .from("economize_ofertas")
      .select("id", { count: "exact", head: true })
      .eq("origem", origem)
      .eq("status", "pendente"),
    supabaseAdmin
      .from("economize_ofertas")
      .select("verificado_em,coletado_em,updated_at")
      .eq("origem", origem)
      .in("status", ["ativo", "pendente"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ultima = ultimaResp.data;
  return {
    ativos: ativosResp.count ?? 0,
    pendentes: pendentesResp.count ?? 0,
    atualizado: ultima?.verificado_em || ultima?.coletado_em || ultima?.updated_at || null,
  };
}

function checkCatalogo(
  slug: string,
  titulo: string,
  dados: { ativos: number; pendentes: number; atualizado: string | null },
  recuperar: string
): Check {
  const total = dados.ativos + dados.pendentes;
  const idade = horasDesde(dados.atualizado);

  if (total === 0) {
    return {
      chave: `catalogo_${slug}`,
      titulo,
      status: "erro",
      mensagem: "Catálogo zerado.",
      metricas: { ...dados, horas_desde_atualizacao: idade },
      recuperar,
    };
  }

  if (idade > 10) {
    return {
      chave: `catalogo_${slug}`,
      titulo,
      status: "erro",
      mensagem: "Catálogo sem atualização há mais de 10 horas.",
      metricas: { ...dados, horas_desde_atualizacao: idade },
      recuperar,
    };
  }

  if (dados.ativos < 20) {
    return {
      chave: `catalogo_${slug}`,
      titulo,
      status: "atencao",
      mensagem: "Poucos produtos ativos; acompanhar a próxima rodada.",
      metricas: { ...dados, horas_desde_atualizacao: idade },
    };
  }

  return {
    chave: `catalogo_${slug}`,
    titulo,
    status: "ok",
    mensagem: "Catálogo alimentado e recente.",
    metricas: { ...dados, horas_desde_atualizacao: idade },
  };
}

async function executarRecuperacao(request: NextRequest, check: Check, anterior: any) {
  if (!check.recuperar || check.status !== "erro") return null;

  const ultimaTentativa = anterior?.recuperacao_tentada_em as string | null | undefined;
  if (ultimaTentativa && horasDesde(ultimaTentativa) < 6) {
    return { sucesso: false, ignorada: true, detalhe: "Recuperação já tentada nas últimas 6 horas." };
  }

  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return { sucesso: false, detalhe: "CRON_SECRET ausente." };

  try {
    const resposta = await fetch(`${request.nextUrl.origin}${check.recuperar}`, {
      headers: { Authorization: `Bearer ${segredo}` },
      cache: "no-store",
    });
    const texto = await resposta.text();
    return {
      sucesso: resposta.ok,
      http: resposta.status,
      detalhe: texto.slice(0, 500),
    };
  } catch (erro) {
    return {
      sucesso: false,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const agoraIso = new Date().toISOString();
  const [
    cea,
    nike,
    kabum,
    ultimaMl,
    ultimaMonitor,
    ultimaViagem,
    precos24h,
    pacotesAtivos,
    pacoteVerificacao,
  ] = await Promise.all([
    contarProdutosAwin("cea"),
    contarProdutosAwin("nike"),
    contarProdutosAwin("kabum"),
    supabaseAdmin
      .from("economize_cupons_candidatos")
      .select("ultima_coleta_em")
      .eq("origem", "mercado_livre_v2")
      .not("ultima_coleta_em", "is", null)
      .order("ultima_coleta_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("produtos")
      .select("ultima_verificacao")
      .not("ultima_verificacao", "is", null)
      .order("ultima_verificacao", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("viagens_execucoes")
      .select("status,erro,iniciada_em,finalizada_em")
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("viagens_precos")
      .select("id", { count: "exact", head: true })
      .gte("observado_em", new Date(Date.now() - 24 * 3_600_000).toISOString()),
    supabaseAdmin
      .from("viagens_pacotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabaseAdmin
      .from("viagens_pacotes")
      .select("disponibilidade_verificada_em")
      .eq("status", "ativo")
      .not("disponibilidade_verificada_em", "is", null)
      .order("disponibilidade_verificada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const checks: Check[] = [
    checkCatalogo("cea", "Catálogo C&A", cea, "/api/admin/economize/awin/produtos/executar"),
    checkCatalogo("nike", "Catálogo Nike", nike, "/api/admin/economize/awin/nike/produtos/executar"),
    checkCatalogo("kabum", "Catálogo KaBuM", kabum, "/api/admin/economize/awin/kabum/produtos/executar"),
  ];

  const mlIdade = horasDesde(ultimaMl.data?.ultima_coleta_em);
  checks.push({
    chave: "cupons_ml_v2",
    titulo: "Cupons Mercado Livre V2",
    status: mlIdade > 10 ? "erro" : mlIdade > 7 ? "atencao" : "ok",
    mensagem: mlIdade > 10 ? "Coleta atrasada." : "Coleta dentro da janela esperada.",
    metricas: {
      ultima_coleta_em: ultimaMl.data?.ultima_coleta_em || null,
      horas_desde_atualizacao: mlIdade,
    },
    ...(mlIdade > 10 ? { recuperar: "/api/admin/economize/cupons/ml-v2/executar" } : {}),
  });

  const monitorIdade = horasDesde(ultimaMonitor.data?.ultima_verificacao);
  checks.push({
    chave: "monitor_precos",
    titulo: "Monitor de preços",
    status: monitorIdade > 10 ? "erro" : monitorIdade > 7 ? "atencao" : "ok",
    mensagem: monitorIdade > 10 ? "Monitor sem atualização recente." : "Monitor recente.",
    metricas: {
      ultima_verificacao: ultimaMonitor.data?.ultima_verificacao || null,
      horas_desde_atualizacao: monitorIdade,
    },
  });

  const viagem = ultimaViagem.data;
  const viagemIdade = horasDesde(viagem?.iniciada_em);
  const qtdPrecos = precos24h.count ?? 0;
  const viagemErro = viagem?.status === "erro";
  checks.push({
    chave: "radar_viagens",
    titulo: "Radar de Viagens",
    status: viagemErro || viagemIdade > 10 || qtdPrecos === 0 ? "erro" : viagemIdade > 7 ? "atencao" : "ok",
    mensagem: viagemErro
      ? `Última execução falhou: ${String(viagem?.erro || "erro sem detalhe").slice(0, 180)}`
      : qtdPrecos === 0
        ? "Nenhum preço coletado nas últimas 24 horas."
        : "Radar coletando normalmente.",
    metricas: {
      ultima_execucao: viagem?.iniciada_em || null,
      status_execucao: viagem?.status || null,
      precos_24h: qtdPrecos,
      horas_desde_execucao: viagemIdade,
    },
  });

  const qtdPacotes = pacotesAtivos.count ?? 0;
  const pacoteIdade = horasDesde(pacoteVerificacao.data?.disponibilidade_verificada_em);
  checks.push({
    chave: "pacotes_viagens",
    titulo: "Verificador de pacotes",
    status: qtdPacotes === 0 ? "ok" : pacoteIdade > 18 ? "erro" : pacoteIdade > 14 ? "atencao" : "ok",
    mensagem: qtdPacotes === 0
      ? "Sem pacotes ativos para verificar."
      : pacoteIdade > 18
        ? "Pacotes ativos sem verificação recente."
        : "Verificação de pacotes dentro da janela.",
    metricas: {
      pacotes_ativos: qtdPacotes,
      ultima_verificacao: pacoteVerificacao.data?.disponibilidade_verificada_em || null,
      horas_desde_verificacao: pacoteIdade,
    },
    ...(qtdPacotes > 0 && pacoteIdade > 18 ? { recuperar: "/api/admin/viagens/pacotes/verificar" } : {}),
  });

  const chaves = checks.map((check) => check.chave);
  const { data: anteriores } = await supabaseAdmin
    .from("sistema_watchdog_status")
    .select("chave,status,primeira_falha_em,ultima_ok_em,recuperacao_tentada_em")
    .in("chave", chaves);

  const anteriorMap = new Map((anteriores || []).map((item: any) => [item.chave, item]));
  let recuperacoes = 0;
  const resultados = [];

  for (const check of checks) {
    const anterior = anteriorMap.get(check.chave) as any;
    const recuperacao = await executarRecuperacao(request, check, anterior);
    if (recuperacao && !recuperacao.ignorada) recuperacoes += 1;

    const primeiraFalha = check.status === "ok"
      ? null
      : (anterior?.primeira_falha_em || agoraIso);

    await supabaseAdmin
      .from("sistema_watchdog_status")
      .upsert({
        chave: check.chave,
        titulo: check.titulo,
        status: check.status,
        mensagem: check.mensagem,
        metricas: check.metricas,
        primeira_falha_em: primeiraFalha,
        ultima_ok_em: check.status === "ok" ? agoraIso : (anterior?.ultima_ok_em || null),
        verificado_em: agoraIso,
        recuperacao_tentada_em: recuperacao && !recuperacao.ignorada
          ? agoraIso
          : (anterior?.recuperacao_tentada_em || null),
        recuperacao_resultado: recuperacao ? JSON.stringify(recuperacao).slice(0, 1000) : null,
        updated_at: agoraIso,
      }, { onConflict: "chave" });

    resultados.push({ ...check, recuperacao });
  }

  const erros = checks.filter((check) => check.status === "erro").length;
  const atencoes = checks.filter((check) => check.status === "atencao").length;
  const geral: Estado = erros > 0 ? "erro" : atencoes > 0 ? "atencao" : "ok";

  await supabaseAdmin
    .from("sistema_watchdog_execucoes")
    .insert({
      status: geral,
      problemas: erros + atencoes,
      recuperacoes,
      detalhes: { checks: resultados },
    });

  return NextResponse.json({
    sucesso: true,
    status: geral,
    erros,
    atencoes,
    recuperacoes,
    checks: resultados,
    verificado_em: agoraIso,
  }, { headers: { "Cache-Control": "no-store" } });
}
