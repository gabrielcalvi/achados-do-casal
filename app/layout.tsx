import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import PartnerPromoBar from "@/components/PartnerPromoBar";
import WhatsAppGrupoFlutuante from "@/components/WhatsAppGrupoFlutuante";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://achadosdocasal.com.br"),
  title: {
    default: "Achados do Casal",
    template: "%s | Achados do Casal",
  },
  description:
    "Ofertas, cupons, promoções, produtos e inteligência de viagem para ajudar você a economizar.",
  applicationName: "Achados do Casal",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Achados do Casal",
    title: "Achados do Casal",
    description:
      "Ofertas, cupons, promoções, produtos e inteligência de viagem para ajudar você a economizar.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://achadosdocasal.com.br/#organization",
  name: "Achados do Casal",
  url: "https://achadosdocasal.com.br",
  logo: "https://achadosdocasal.com.br/logo-achados-do-casal.png",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://achadosdocasal.com.br/#website",
  name: "Achados do Casal",
  url: "https://achadosdocasal.com.br",
  publisher: { "@id": "https://achadosdocasal.com.br/#organization" },
  inLanguage: "pt-BR",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-950">
        <script id="organization-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />
        <script id="website-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }} />
        <PartnerPromoBar />
        {children}
        <WhatsAppGrupoFlutuante />
        <Analytics />
      </body>
    </html>
  );
}
