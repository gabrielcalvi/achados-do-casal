import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";

export const metadata: Metadata = {
  title: "Ofertas Casas Bahia: móveis e eletrodomésticos",
  description: "Ofertas Casas Bahia de móveis, eletrodomésticos, TVs, cozinha e casa selecionadas pelo Achados do Casal.",
  alternates: { canonical: "/casas-bahia" },
  openGraph: {
    title: "Ofertas Casas Bahia | Achados do Casal",
    description: "Ofertas Casas Bahia de móveis, eletrodomésticos, TVs, cozinha e casa selecionadas pelo Achados do Casal.",
    url: "/casas-bahia",
    type: "website",
  },
};

export default function CasasBahiaPage() {
  return (
    <PartnerStorefront
      slug="casas-bahia"
      nome="Casas Bahia"
      descricao="Móveis, eletrodomésticos, TVs, cozinha, climatização, colchões e casa com oportunidades selecionadas no catálogo oficial do parceiro."
      placeholder="Buscar móveis, eletrodomésticos, TV, cozinha..."
      cor="#1f4aa8"
    />
  );
}
