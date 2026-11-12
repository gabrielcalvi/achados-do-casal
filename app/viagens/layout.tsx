import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viagens baratas, passagens, pacotes e ingressos",
  description:
    "Radar de passagens, pacotes, ingressos e oportunidades de viagem com preços reais e comparação para ajudar você a viajar pagando menos.",
  alternates: {
    canonical: "/viagens",
  },
  openGraph: {
    title: "Viagens | Achados do Casal",
    description:
      "Radar de passagens, pacotes, ingressos e oportunidades para viajar melhor e pagar menos.",
    url: "/viagens",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viagens | Achados do Casal",
    description:
      "Radar de passagens, pacotes, ingressos e oportunidades de viagem.",
  },
};

export default function ViagensLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
