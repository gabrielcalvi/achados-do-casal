import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
        <div className="bg-black text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-5 py-2.5 text-center">
            <Link
              href="/nike"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-black uppercase tracking-[0.16em] transition hover:bg-white hover:text-black"
            >
              <span aria-hidden="true">🔥</span>
              Destaque Nike · Ver ofertas →
            </Link>
            <Link
              href="/kabum"
              className="inline-flex items-center gap-2 rounded-full bg-[#ff6500] px-5 py-2 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#e65c00]"
            >
              <span aria-hidden="true">⚡</span>
              KaBuM · Ver ofertas →
            </Link>
          </div>
        </div>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
