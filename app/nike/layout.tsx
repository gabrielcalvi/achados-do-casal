import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ofertas Nike: tênis, roupas e acessórios",
  description: "Ofertas Nike de tênis, roupas e acessórios selecionadas e atualizadas pelo Achados do Casal.",
  alternates: { canonical: "/nike" },
  openGraph: {
    title: "Ofertas Nike | Achados do Casal",
    description: "Ofertas Nike de tênis, roupas e acessórios selecionadas e atualizadas pelo Achados do Casal.",
    url: "/nike",
    type: "website",
  },
};

export default function NikeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
