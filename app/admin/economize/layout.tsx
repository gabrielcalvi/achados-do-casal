import Link from "next/link";

export default function AdminEconomizeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Admin · Central Economize
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/economize"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black transition hover:bg-white hover:text-black"
            >
              💰 Economize
            </Link>
            <Link
              href="/admin/economize/performance"
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-black text-white transition hover:bg-violet-500"
            >
              📊 Performance
            </Link>
            <Link
              href="/admin/economize/nike"
              className="rounded-lg bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-zinc-200"
            >
              ✓ NIKE / AWIN
            </Link>
            <Link
              href="/admin/economize/kabum"
              className="rounded-lg bg-[#ff6500] px-4 py-2 text-xs font-black text-white transition hover:bg-[#e65c00]"
            >
              ✓ KABUM / AWIN
            </Link>
            <Link
              href="/nike"
              target="_blank"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-black transition hover:bg-white/10"
            >
              Nike pública ↗
            </Link>
            <Link
              href="/kabum"
              target="_blank"
              className="rounded-lg border border-[#ff6500]/60 px-3 py-2 text-xs font-black text-[#ff9a57] transition hover:bg-[#ff6500] hover:text-white"
            >
              KaBuM pública ↗
            </Link>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
