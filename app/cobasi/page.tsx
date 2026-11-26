import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";
import { carregarOfertasIniciais } from "@/lib/economize/storefrontServer";

export const metadata: Metadata = {
  title: "Ofertas Cobasi: pet, ração e acessórios",
  description: "Ofertas Cobasi para cães, gatos e outros pets, com ração, petiscos, higiene e acessórios selecionados pelo Achados do Casal.",
  alternates: { canonical: "/cobasi" },
  openGraph: {
    title: "Ofertas Cobasi | Achados do Casal",
    description: "Ofertas Cobasi para cães, gatos e outros pets, com ração, petiscos, higiene e acessórios selecionados pelo Achados do Casal.",
    url: "/cobasi",
    type: "website",
  },
};

export default async function CobasiPage() {
  const initialOffers = await carregarOfertasIniciais("cobasi");
  return (
    <PartnerStorefront
      slug="cobasi"
      initialOffers={initialOffers}
      nome="Cobasi"
      descricao="Produtos para cães, gatos e outros pets selecionados no catálogo oficial do parceiro, sempre com página compartilhável do Achados e link afiliado oficial."
      placeholder="Buscar ração, petisco, higiene, brinquedos..."
      cor="#f58220"
    />
  );
}
