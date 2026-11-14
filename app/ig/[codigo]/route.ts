import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  aplicarCookieAtribuicao,
  aplicarCookieSessao,
  CAMPANHAS_RASTREADAS,
  COOKIE_SESSAO_ECONOMIZE,
  type AtribuicaoCampanha,
} from "@/lib/economize/campaignAttribution";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PADRAO_BOT = /(bot|crawler|spider|slurp|googlebot|bingbot|duckduckbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|telegrambot|discordbot|slackbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|applebot|gptbot|chatgpt-user|oai-searchbot|chrome-lighthouse|pagespeed|lighthouse|headlesschrome|readbot)/i;

function limitarTexto(valor: string | null, limite = 1000) {
  return valor ? valor.slice(0, limite) : null;
}

function obterIp(request: NextRequest) {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || null;
}

function gerarHashIp(ip: string | null) {
  const salt = process.env.ECONOMIZE_IP_HASH_SALT;
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function classificarTrafego(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() || "";
  const referer = request.headers.get("referer")?.trim() || "";

  try {
    if (referer) {
      const urlReferer = new URL(referer);
      if (
        urlReferer.pathname === "/admin" ||
        urlReferer.pathname.startsWith("/admin/")
      ) {
        return { tipo: "interno", motivo: "referer_admin" } as const;
      }
    }
  } catch {
    // Referer inválido não interrompe o redirecionamento.
  }

  if (!userAgent) {
    return { tipo: "nao_classificado", motivo: "sem_user_agent" } as const;
  }
  if (PADRAO_BOT.test(userAgent)) {
    return { tipo: "bot", motivo: "user_agent_automatizado" } as const;
  }
  return { tipo: "humano_provavel", motivo: "navegador_normal" } as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const definicao = CAMPANHAS_RASTREADAS[codigo.trim().toLowerCase()];

  if (!definicao) {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  const sessaoRecebida =
    request.cookies.get(COOKIE_SESSAO_ECONOMIZE)?.value || "";
  const possuiSessaoValida = UUID_REGEX.test(sessaoRecebida);
  const sessaoId = possuiSessaoValida ? sessaoRecebida : randomUUID();
  const classificacao = classificarTrafego(request);

  const { data: visita, error } = await supabaseAdmin
    .from("economize_campanha_visitas")
    .insert({
      codigo: definicao.codigo,
      source: definicao.source,
      medium: definicao.medium,
      campaign: definicao.campaign,
      content: definicao.content,
      landing_path: definicao.destino,
      session_id: sessaoId,
      referer: limitarTexto(request.headers.get("referer")),
      user_agent: limitarTexto(request.headers.get("user-agent")),
      ip_hash: gerarHashIp(obterIp(request)),
      trafego_tipo: classificacao.tipo,
      trafego_motivo: classificacao.motivo,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao registrar entrada de campanha:", error);
  }

  const destino = new URL(definicao.destino, request.url);
  destino.searchParams.set("utm_source", definicao.source);
  destino.searchParams.set("utm_medium", definicao.medium);
  destino.searchParams.set("utm_campaign", definicao.campaign);
  destino.searchParams.set("utm_content", definicao.content);

  const resposta = NextResponse.redirect(destino, 307);
  resposta.headers.set("Cache-Control", "no-store");
  resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
  aplicarCookieSessao(resposta, sessaoId, !possuiSessaoValida);

  const visitaId = Number(visita?.id);
  if (Number.isSafeInteger(visitaId) && visitaId > 0) {
    const atribuicao: AtribuicaoCampanha = {
      versao: 1,
      visitaId,
      codigo: definicao.codigo,
      source: definicao.source,
      medium: definicao.medium,
      campaign: definicao.campaign,
      content: definicao.content,
      atribuidaEm: new Date().toISOString(),
    };
    aplicarCookieAtribuicao(resposta, atribuicao);
  }

  return resposta;
}
