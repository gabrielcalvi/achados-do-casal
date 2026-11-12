import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cupons, promoções e ofertas verificadas",
  description:
    "Encontre cupons, promoções, descontos, cashback e ofertas verificadas nas principais lojas do Brasil.",
  alternates: {
    canonical: "/economize",
  },
  openGraph: {
    title: "Central Economize | Achados do Casal",
    description:
      "Cupons, promoções, descontos, cashback e oportunidades verificadas para economizar nas principais lojas.",
    url: "/economize",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Central Economize | Achados do Casal",
    description:
      "Cupons, promoções, descontos e ofertas verificadas em um só lugar.",
  },
};

export default function EconomizeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
