import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = "https://achadosdocasal.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date().toISOString();

  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/economize`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
    { url: `${BASE}/viagens`, lastModified: new Date(), changeFrequency: "daily", priority: 0.95 },
    { url: `${BASE}/reviews`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/nike`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/kabum`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/renner`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/cea`, lastModified: new Date(), changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/cobasi`, lastModified: new Date(), changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/casas-bahia`, lastModified: new Date(), changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/gamer`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/lauri-esporte`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ];

  const [ofertas, produtos, pacotes, ingressos] = await Promise.all([
    supabaseAdmin
      .from("economize_ofertas")
      .select("id,updated_at")
      .eq("status", "ativo")
      .or(`validade.is.null,validade.gt.${agora}`)
      .limit(5000),
    supabaseAdmin
      .from("produtos")
      .select("id,updated_at")
      .or("ativo.eq.true,review_completa.eq.true")
      .limit(5000),
    supabaseAdmin
      .from("viagens_pacotes")
      .select("id,updated_at")
      .eq("status", "ativo")
      .in("disponibilidade_status", ["disponivel", "nao_verificado"])
      .or(`validade.is.null,validade.gt.${agora}`)
      .limit(1000),
    supabaseAdmin
      .from("viagens_ingressos")
      .select("id,updated_at")
      .eq("status", "ativo")
      .or(`validade.is.null,validade.gt.${agora}`)
      .limit(1000),
  ]);

  const dinamicas: MetadataRoute.Sitemap = [
    ...(ofertas.data ?? []).map((item) => ({
      url: `${BASE}/achado/${item.id}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.75,
    })),
    ...(produtos.data ?? []).map((item) => ({
      url: `${BASE}/produto/${item.id}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(pacotes.data ?? []).map((item) => ({
      url: `${BASE}/viagens/pacote/${item.id}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(ingressos.data ?? []).map((item) => ({
      url: `${BASE}/viagens/ingresso/${item.id}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  return [...estaticas, ...dinamicas];
}
