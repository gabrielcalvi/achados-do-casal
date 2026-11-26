import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";

export const metadata: Metadata = {
  title: "Ofertas C&A: moda, beleza e lifestyle",
  description: "Ofertas C&A de moda, beleza, acessórios e lifestyle selecionadas e atualizadas pelo Achados do Casal.",
  alternates: { canonical: "/cea" },
  openGraph: {
    title: "Ofertas C&A | Achados do Casal",
    description: "Ofertas C&A de moda, beleza, acessórios e lifestyle selecionadas e atualizadas pelo Achados do Casal.",
    url: "/cea",
    type: "website",
  },
};

export default function CeaPage() {
  return (
    <PartnerStorefront
      slug="cea"
      nome="C&A"
      descricao="Moda, beleza e lifestyle com as melhores oportunidades encontradas no catálogo oficial do parceiro."
      placeholder="Buscar roupas, acessórios, beleza..."
      cor="#e30613"
    />
  );
}
