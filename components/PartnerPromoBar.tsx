"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PartnerPromoBar() {
  const pathname = usePathname();

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/viagens")
  ) {
    return null;
  }

  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-5 py-2.5 text-center">
        <Link
          href="/nike"
          className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-black uppercase tracking-[0.12em] transition hover:bg-white hover:text-black"
        >
          NIKE · VER OFERTAS
        </Link>
        <Link
          href="/kabum"
          className="inline-flex items-center rounded-full bg-[#ff6500] px-5 py-2 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#e65c00]"
        >
          KABUM · VER OFERTAS
        </Link>
        <Link
          href="/cea"
          className="inline-flex items-center rounded-full bg-[#e30613] px-5 py-2 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#c5000c]"
        >
          C&A · VER OFERTAS
        </Link>
      </div>
    </div>
  );
}
