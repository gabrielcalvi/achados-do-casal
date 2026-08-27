import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOME_COOKIE_SESSAO = "economize_session";
const ORIGENS_PERMITIDAS = new Set(["site", "whatsapp", "telegram", "instagram", "admin"]);
const PADRAO_BOT = /(bot|crawler|spider|slurp|googlebot|bingbot|duckduckbot|yandex|baiduspider|facebookexternalhit|twitterbot|linkedinbot|telegrambot|discordbot|slackbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|applebot|gptbot|chatgpt-user|oai-searchbot|chrome-lighthouse|pagespeed|lighthouse|headlesschrome|readbot)/i;

function urlSegura(valor: unknown) {
  if (typeof valor !== "string") return false;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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

function classificar(request: NextRequest, origem: string) {
  const userAgent = request.headers.get("user-agent")?.trim() || "";
  const referer = request.headers.get("referer")?.trim() || "";

  if (origem === "admin") return { tipo: "interno", motivo: "origem_admin" } as const;
  try {
    if (referer) {
      const url = new URL(referer);
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
        return { tipo: "interno", motivo: "referer_admin" } as const;
      }
    }
  } catch {}

  if (!userAgent) return { tipo: "nao_classificado", motivo: "sem_user_agent" } as const;
  if (PADRAO_BOT.test(userAgent)) return { tipo: "bot", motivo: "user_agent_automatizado" } as const;
  return { tipo: "humano_provavel", motivo: "navegador_normal" } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produtoId = Number(id);
  if (!Number.isFinite(produtoId) || produtoId <= 0) {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  const { data: produto } = await supabaseAdmin
    .from("produtos")
    .select("id,ativo,link,link_afiliado")
    .eq("id", produtoId)
    .maybeSingle();

  if (!produto || produto.ativo === false) {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  const destino = String(produto.link_afiliado || produto.link || "").trim();
  if (!urlSegura(destino)) return NextResponse.redirect(new URL("/", request.url), 307);

  const origemRecebida = request.nextUrl.searchParams.get("origem")?.trim().toLowerCase() || "site";
  const origem = ORIGENS_PERMITIDAS.has(origemRecebida) ? origemRecebida : "site";
  const sessaoRecebida = request.cookies.get(NOME_COOKIE_SESSAO)?.value || "";
  const sessaoValida = /^[0-9a-f-]{36}$/i.test(sessaoRecebida);
  const sessaoId = sessaoValida ? sessaoRecebida : randomUUID();
  const classificacao = classificar(request, origem);

  await supabaseAdmin.from("economize_cliques").insert({
    produto_id: produtoId,
    origem,
    rota: request.nextUrl.pathname,
    referer: request.headers.get("referer")?.slice(0, 1000) || null,
    user_agent: request.headers.get("user-agent")?.slice(0, 1000) || null,
    session_id: sessaoId,
    ip_hash: gerarHashIp(obterIp(request)),
    trafego_tipo: classificacao.tipo,
    trafego_motivo: classificacao.motivo,
  });

  const resposta = NextResponse.redirect(new URL(destino), 307);
  resposta.headers.set("Cache-Control", "no-store");
  if (!sessaoValida) {
    resposta.cookies.set({ name: NOME_COOKIE_SESSAO, value: sessaoId, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return resposta;
}
