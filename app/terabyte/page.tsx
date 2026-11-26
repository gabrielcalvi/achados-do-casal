import type { Metadata } from "next";
import PartnerStorefront from "@/components/PartnerStorefront";
import { carregarOfertasIniciais } from "@/lib/economize/storefrontServer";

export const metadata: Metadata = {
  title: "Ofertas TeraByte: hardware, PC Gamer e periféricos",
  description: "Ofertas TeraByte de hardware, PC Gamer, monitores, componentes e periféricos com preços atualizados pelo Achados do Casal.",
  alternates: { canonical: "/terabyte" },
  openGraph: {
    title: "Ofertas TeraByte | Achados do Casal",
    description: "Ofertas TeraByte de hardware, PC Gamer, monitores, componentes e periféricos com preços atualizados pelo Achados do Casal.",
    url: "/terabyte",
    type: "website",
  },
};

export default async function TerabytePage() {
  const initialOffers = await carregarOfertasIniciais("terabyte");
  return (
    <PartnerStorefront
      slug="terabyte"
      initialOffers={initialOffers}
      nome="TeraByte"
      descricao="Hardware, PC Gamer, periféricos e notebooks com preços coletados diretamente da TeraByte e links monetizados pelo canal do Achados do Casal na Lomadee."
      placeholder="Buscar placa de vídeo, processador, monitor, cadeira..."
      cor="#ff4b1f"
      rede="TeraByte + Lomadee"
    />
  );
}
