import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Passagens sob medida, pacotes e ingressos",
  description:
    "Peça uma cotação de passagem sob medida pelo WhatsApp e encontre pacotes, ingressos e oportunidades de viagem selecionadas pelo Achados do Casal.",
  alternates: {
    canonical: "/viagens",
  },
  openGraph: {
    title: "Viagens | Achados do Casal",
    description:
      "Cotações de passagens sob demanda, pacotes, ingressos e oportunidades para viajar melhor e pagar menos.",
    url: "/viagens",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viagens | Achados do Casal",
    description:
      "Cotações de passagens sob demanda, pacotes, ingressos e oportunidades de viagem.",
  },
};

export default function ViagensLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
