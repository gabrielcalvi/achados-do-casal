import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";
import { carregarOfertasIniciais } from "@/lib/economize/storefrontServer";

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

export default async function CeaPage() {
  const initialOffers = await carregarOfertasIniciais("cea");
  return (
    <PartnerStorefront
      slug="cea"
      initialOffers={initialOffers}
      nome="C&A"
      descricao="Moda, beleza e lifestyle com as melhores oportunidades encontradas no catálogo oficial do parceiro."
      placeholder="Buscar roupas, acessórios, beleza..."
      cor="#e30613"
    />
  );
}
