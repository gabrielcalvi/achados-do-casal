import Link from "next/link";
import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

const links = [
  { href: "/admin", label: "📦 Produtos" },
  { href: "/admin/monitor", label: "📈 Monitor" },
  { href: "/admin/economize", label: "💰 Economize" },
  { href: "/admin/economize/ml-v2", label: "🏷️ Cupons ML V2" },
  { href: "/admin/viagens", label: "✈️ Viagens / Radar" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <>
      <style>{`
        main header a[href="/admin"],
        main header a[href="/admin/monitor"] {
          display: none !important;
        }

        main nav:has(a[href="/admin"]) {
          display: none !important;
        }

        main .mx-auto.max-w-7xl > .flex > .flex.items-center.gap-3 > a[href="/admin"],
        main .mx-auto.max-w-7xl > .flex > .flex.items-center.gap-3 > a[href="/admin/monitor"] {
          display: none !important;
        }
      `}</style>

      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-8 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="shrink-0 text-xs font-black uppercase tracking-wider text-pink-500 hover:text-pink-600"
            >
              Achados · Admin
            </Link>
            <Link
              href="/"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              Ver site ↗
            </Link>
          </div>

          <nav className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {children}
    </>
  );
}
