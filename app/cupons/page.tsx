import type { Metadata } from "next";
import BlackFridayPage from "../black-friday/page";

export const metadata: Metadata = {
  title: "Cupons e promoções verificadas",
  description:
    "Cupons, campanhas e promoções verificadas e atualizadas pelo Achados do Casal.",
  alternates: { canonical: "/cupons" },
  openGraph: {
    title: "Cupons e promoções verificadas | Achados do Casal",
    description: "Cupons, campanhas e promoções verificadas e atualizadas pelo Achados do Casal.",
    url: "/cupons",
    type: "website",
  },
};

export default function CuponsPage() {
  return <BlackFridayPage />;
}
