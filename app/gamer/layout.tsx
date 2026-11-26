import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ofertas gamer, setup e reviews",
  description: "Produtos gamer, setup, periféricos e reviews selecionados pelo Achados do Casal.",
  alternates: { canonical: "/gamer" },
  openGraph: {
    title: "Gamer | Achados do Casal",
    description: "Produtos gamer, setup, periféricos e reviews selecionados pelo Achados do Casal.",
    url: "/gamer",
    type: "website",
  },
};

export default function GamerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
