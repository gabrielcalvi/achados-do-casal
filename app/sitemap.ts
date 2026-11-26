import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = "https://achadosdocasal.com.br";

function dataOuUndefined(valor: string | null | undefined) {
  return valor ? new Date(valor) : undefined;
}

function maisRecente(...datas: Array<Date | undefined>) {
  const validas = datas.filter((data): data is Date => Boolean(data && !Number.isNaN(data.getTime())));
  return validas.length ? new Date(Math.max(...validas.map((data) => data.getTime()))) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date().toISOString();

  const [ultimaOfertaResp, ultimoProdutoResp, ultimoPacoteResp] = await Promise.all([
    supabaseAdmin.from("economize_ofertas").select("updated_at").eq("status", "ativo").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("produtos").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("viagens_pacotes").select("updated_at").eq("status", "ativo").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const ultimaAtualizacaoEconomize = dataOuUndefined(ultimaOfertaResp.data?.updated_at);
  const ultimaAtualizacaoProdutos = dataOuUndefined(ultimoProdutoResp.data?.updated_at);
  const ultimaAtualizacaoViagens = dataOuUndefined(ultimoPacoteResp.data?.updated_at);
  const ultimaAtualizacaoHome = maisRecente(ultimaAtualizacaoEconomize, ultimaAtualizacaoProdutos, ultimaAtualizacaoViagens);

  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: ultimaAtualizacaoHome, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/economize`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "hourly", priority: 0.95 },
    { url: `${BASE}/cupons`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "hourly", priority: 0.98 },
    { url: `${BASE}/black-friday`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/viagens`, lastModified: ultimaAtualizacaoViagens, changeFrequency: "daily", priority: 0.95 },
    { url: `${BASE}/reviews`, lastModified: ultimaAtualizacaoProdutos, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/nike`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/kabum`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/terabyte`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "hourly", priority: 0.85 },
    { url: `${BASE}/renner`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/cea`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/cobasi`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/casas-bahia`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/gamer`, lastModified: ultimaAtualizacaoProdutos, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/lauri-esporte`, lastModified: ultimaAtualizacaoEconomize, changeFrequency: "daily", priority: 0.8 },
  ];

  const [ofertas, produtos, pacotes] = await Promise.all([
    supabaseAdmin.from("economize_ofertas").select("id,updated_at").eq("status", "ativo").or(`validade.is.null,validade.gt.${agora}`).limit(5000),
    supabaseAdmin.from("produtos").select("id,updated_at").or("ativo.eq.true,review_completa.eq.true").limit(5000),
    supabaseAdmin.from("viagens_pacotes").select("id,tipo,updated_at,disponibilidade_status").eq("status", "ativo").is("arquivado_em", null).or(`validade.is.null,validade.gt.${agora}`).limit(1000),
  ]);

  const dinamicas: MetadataRoute.Sitemap = [
    ...(ofertas.data ?? []).map((item) => ({ url: `${BASE}/achado/${item.id}`, lastModified: dataOuUndefined(item.updated_at), changeFrequency: "daily" as const, priority: 0.75 })),
    ...(produtos.data ?? []).map((item) => ({ url: `${BASE}/produto/${item.id}`, lastModified: dataOuUndefined(item.updated_at), changeFrequency: "daily" as const, priority: 0.7 })),
    ...(pacotes.data ?? []).filter((item) => item.tipo !== "pacote" || ["disponivel", "nao_verificado"].includes(String(item.disponibilidade_status || "nao_verificado"))).map((item) => ({ url: `${BASE}/viagens/pacote/${item.id}`, lastModified: dataOuUndefined(item.updated_at), changeFrequency: "daily" as const, priority: 0.8 })),
  ];

  return [...estaticas, ...dinamicas];
}
