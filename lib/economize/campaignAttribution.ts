import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const COOKIE_ATRIBUICAO_CAMPANHA = "economize_campaign_attribution";
export const COOKIE_SESSAO_ECONOMIZE = "economize_session";
export const ATRIBUICAO_MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 30;

const VERSAO_ATRIBUICAO = 2 as const;
const TOKEN_REGEX = /^[a-z0-9][a-z0-9_-]{0,119}$/;

type DefinicaoCampanha = {
  codigo: string;
  nome: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destino: string;
};

export const CAMPANHAS_RASTREADAS: Record<string, DefinicaoCampanha> = {
  "black-gabriel": {
    codigo: "black-gabriel",
    nome: "Instagram Gabriel",
    source: "instagram",
    medium: "social",
    campaign: "black_friday_2026",
    content: "instagram_gabriel",
    destino: "/black-friday",
  },
  "black-bruna": {
    codigo: "black-bruna",
    nome: "Instagram Bruna",
    source: "instagram",
    medium: "social",
    campaign: "black_friday_2026",
    content: "instagram_bruna",
    destino: "/black-friday",
  },
  "black-achados": {
    codigo: "black-achados",
    nome: "Instagram Achados do Casal",
    source: "instagram",
    medium: "social",
    campaign: "black_friday_2026",
    content: "instagram_achados",
    destino: "/black-friday",
  },
};

export type AtribuicaoCampanha = {
  versao: typeof VERSAO_ATRIBUICAO;
  visitaId: number;
  codigo: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  atribuidaEm: string;
};

function tokenValido(valor: unknown) {
  return typeof valor === "string" && TOKEN_REGEX.test(valor);
}

function segredoAssinatura() {
  return (
    process.env.ECONOMIZE_CAMPAIGN_SIGNING_SECRET?.trim() ||
    process.env.ECONOMIZE_IP_HASH_SALT?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function assinarPayload(payload: string) {
  const segredo = segredoAssinatura();
  if (!segredo) return null;
  return createHmac("sha256", segredo).update(payload).digest("base64url");
}

function assinaturaValida(payload: string, recebida: string) {
  const esperada = assinarPayload(payload);
  if (!esperada) return false;

  const bufferEsperado = Buffer.from(esperada, "utf8");
  const bufferRecebido = Buffer.from(recebida, "utf8");
  if (bufferEsperado.length !== bufferRecebido.length) return false;
  return timingSafeEqual(bufferEsperado, bufferRecebido);
}

function atribuicaoValida(valor: unknown): valor is AtribuicaoCampanha {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<AtribuicaoCampanha>;
  if (item.versao !== VERSAO_ATRIBUICAO) return false;
  if (!Number.isSafeInteger(item.visitaId) || Number(item.visitaId) <= 0) return false;
  if (!tokenValido(item.codigo)) return false;
  if (!tokenValido(item.source)) return false;
  if (!tokenValido(item.medium)) return false;
  if (!tokenValido(item.campaign)) return false;
  if (!tokenValido(item.content)) return false;
  if (typeof item.atribuidaEm !== "string") return false;

  const instante = Date.parse(item.atribuidaEm);
  if (!Number.isFinite(instante)) return false;
  const idade = Date.now() - instante;
  if (idade < -5 * 60 * 1000) return false;
  if (idade > ATRIBUICAO_MAX_AGE_SEGUNDOS * 1000) return false;
  return true;
}

export function codificarAtribuicaoCampanha(atribuicao: AtribuicaoCampanha) {
  const payload = Buffer.from(JSON.stringify(atribuicao), "utf8").toString(
    "base64url",
  );
  const assinatura = assinarPayload(payload);
  return assinatura ? `${payload}.${assinatura}` : null;
}

export function lerAtribuicaoCampanha(request: NextRequest) {
  const bruto = request.cookies.get(COOKIE_ATRIBUICAO_CAMPANHA)?.value;
  if (!bruto) return null;

  try {
    const separador = bruto.lastIndexOf(".");
    if (separador <= 0 || separador === bruto.length - 1) return null;

    const payload = bruto.slice(0, separador);
    const assinatura = bruto.slice(separador + 1);
    if (!assinaturaValida(payload, assinatura)) return null;

    const json = Buffer.from(payload, "base64url").toString("utf8");
    const valor = JSON.parse(json) as unknown;
    return atribuicaoValida(valor) ? valor : null;
  } catch {
    return null;
  }
}

export function aplicarCookieAtribuicao(
  resposta: NextResponse,
  atribuicao: AtribuicaoCampanha,
) {
  const valor = codificarAtribuicaoCampanha(atribuicao);
  if (!valor) {
    console.error(
      "Atribuição de campanha não foi persistida: segredo de assinatura ausente.",
    );
    return;
  }

  resposta.cookies.set({
    name: COOKIE_ATRIBUICAO_CAMPANHA,
    value: valor,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ATRIBUICAO_MAX_AGE_SEGUNDOS,
  });
}

export function aplicarCookieSessao(
  resposta: NextResponse,
  sessaoId: string,
  criar: boolean,
) {
  if (!criar) return;
  resposta.cookies.set({
    name: COOKIE_SESSAO_ECONOMIZE,
    value: sessaoId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function inserirCliqueComAtribuicao(
  request: NextRequest,
  dados: Record<string, unknown>,
  atribuicaoInformada?: AtribuicaoCampanha | null,
) {
  const atribuicao = atribuicaoInformada ?? lerAtribuicaoCampanha(request);
  const payload = atribuicao
    ? { ...dados, campanha_visita_id: atribuicao.visitaId }
    : dados;

  const primeiraTentativa = await supabaseAdmin
    .from("economize_cliques")
    .insert(payload);

  if (primeiraTentativa.error?.code === "23503" && atribuicao) {
    const segundaTentativa = await supabaseAdmin
      .from("economize_cliques")
      .insert(dados);
    return segundaTentativa.error;
  }

  return primeiraTentativa.error;
}
