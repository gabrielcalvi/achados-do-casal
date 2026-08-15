import Link from "next/link";
import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <>
      <style>{`
        /*
         * A navegacao principal agora pertence ao layout do Admin.
         * Escondemos apenas os atalhos antigos repetidos que ainda
         * existem dentro das paginas, preservando as acoes locais
         * como Novo Produto, Sair e Revisar alteracoes.
         */
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

      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-black uppercase tracking-wider text-pink-500">
            Admin
          </span>

          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            📦 Produtos
          </Link>

          <Link
            href="/admin/monitor"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            📈 Monitor
          </Link>

          <Link
            href="/admin/economize"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
          >
            💰 Central Economize
          </Link>

          <Link
            href="/admin/economize/ml-v2"
            className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800 transition hover:bg-blue-100"
          >
            🏷️ Cupons ML V2
          </Link>

          <Link
            href="/admin/viagens"
            className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-black text-violet-800 transition hover:bg-violet-100"
          >
            ✈️ Viagens / Radar
          </Link>
        </div>
      </div>

      {children}
    </>
  );
}
