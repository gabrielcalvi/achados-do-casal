import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";
import { carregarOfertasIniciais } from "@/lib/economize/storefrontServer";

export const metadata: Metadata = {
  title: "Ofertas Renner: moda, casa e lifestyle",
  description: "Ofertas Renner de moda, casa, acessórios e lifestyle selecionadas e atualizadas pelo Achados do Casal.",
  alternates: { canonical: "/renner" },
  openGraph: {
    title: "Ofertas Renner | Achados do Casal",
    description: "Ofertas Renner de moda, casa, acessórios e lifestyle selecionadas e atualizadas pelo Achados do Casal.",
    url: "/renner",
    type: "website",
  },
};

export default async function RennerPage() {
  const initialOffers = await carregarOfertasIniciais("renner");
  return (
    <PartnerStorefront
      slug="renner"
      initialOffers={initialOffers}
      nome="Renner"
      descricao="Moda, casa e lifestyle com oportunidades selecionadas no catálogo oficial do parceiro, sempre com os melhores descontos primeiro."
      placeholder="Buscar moda, casa, acessórios..."
      cor="#8b1e2d"
    />
  );
}
