import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Black Friday 2026: cupons e promoções verificadas",
  description: "Cupons e promoções de Black Friday encontrados e verificados pelo Achados do Casal.",
  alternates: { canonical: "/black-friday" },
  openGraph: {
    title: "Black Friday 2026 | Achados do Casal",
    description: "Cupons e promoções de Black Friday encontrados e verificados pelo Achados do Casal.",
    url: "/black-friday",
    type: "website",
  },
};

export default function BlackFridayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
