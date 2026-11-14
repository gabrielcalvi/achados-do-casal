import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Passagens, hotéis, pacotes e ofertas de viagem",
  description:
    "Peça uma cotação de passagem sob medida e encontre pacotes, hotéis, ingressos, carros, cruzeiros e experiências selecionadas pelo Achados do Casal.",
  alternates: {
    canonical: "/viagens",
  },
  openGraph: {
    title: "Viagens | Achados do Casal",
    description:
      "Cotações de passagens sob demanda, pacotes, hotéis, ingressos, carros, cruzeiros e experiências para viajar melhor e pagar menos.",
    url: "/viagens",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viagens | Achados do Casal",
    description:
      "Cotações de passagens sob demanda e ofertas de hotéis, pacotes, ingressos, carros, cruzeiros e experiências.",
  },
};

export default function ViagensLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
