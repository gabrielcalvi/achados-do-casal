import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ofertas KaBuM!: tecnologia, hardware e gamer",
  description: "Ofertas KaBuM! de hardware, tecnologia, periféricos e produtos gamer selecionadas pelo Achados do Casal.",
  alternates: { canonical: "/kabum" },
  openGraph: {
    title: "Ofertas KaBuM! | Achados do Casal",
    description: "Ofertas KaBuM! de hardware, tecnologia, periféricos e produtos gamer selecionadas pelo Achados do Casal.",
    url: "/kabum",
    type: "website",
  },
};

export default function KabumLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
