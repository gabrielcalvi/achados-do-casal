import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BASE_URL = "https://achadosdocasal.com.br";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Cupons de desconto, promoções e ofertas",
  description:
    "Encontre cupons de desconto, promoções, cashback, frete grátis e ofertas verificadas nas principais lojas do Brasil.",
  alternates: {
    canonical: `${BASE_URL}/economize`,
  },
  openGraph: {
    title: "Cupons, promoções e ofertas | Achados do Casal",
    description:
      "Cupons de desconto, promoções, cashback, frete grátis e oportunidades verificadas para economizar.",
    url: `${BASE_URL}/economize`,
    siteName: "Achados do Casal",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cupons, promoções e ofertas | Achados do Casal",
    description:
      "Cupons de desconto, promoções, cashback e ofertas verificadas em um só lugar.",
  },
};

async function carregarOfertasSeo() {
  const agora = new Date().toISOString();

  const { data } = await supabaseAdmin
    .from("economize_ofertas")
    .select(`
      id,
      titulo,
      descricao,
      imagem_url,
      preco_oferta,
      desconto_percentual,
      updated_at,
      loja:economize_lojas!inner (
        nome,
        ativa
      )
    `)
    .eq("status", "ativo")
    .eq("economize_lojas.ativa", true)
    .or(`validade.is.null,validade.gt.${agora}`)
    .order("destaque", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(20);

  return data ?? [];
}

export default async function EconomizeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ofertas = await carregarOfertasSeo();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Cupons, promoções e ofertas do Achados do Casal",
    url: `${BASE_URL}/economize`,
    numberOfItems: ofertas.length,
    itemListElement: ofertas.map((oferta, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${BASE_URL}/achado/${oferta.id}`,
      name: oferta.titulo,
    })),
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Cupons, promoções e ofertas",
    description:
      "Central de cupons de desconto, promoções, cashback, frete grátis e ofertas verificadas do Achados do Casal.",
    url: `${BASE_URL}/economize`,
    isPartOf: {
      "@type": "WebSite",
      name: "Achados do Casal",
      url: BASE_URL,
    },
    mainEntity: {
      "@id": `${BASE_URL}/economize#ofertas`,
    },
  };

  return (
    <>
      <script
        id="economize-collection-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webPageJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        id="economize-itemlist-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...itemListJsonLd,
            "@id": `${BASE_URL}/economize#ofertas`,
          }).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}
