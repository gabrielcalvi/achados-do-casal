import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Achados do Casal",
    title: "Achados do Casal",
    description:
      "Ofertas, cupons, promoções, produtos e inteligência de viagem para ajudar você a economizar.",
    url: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
