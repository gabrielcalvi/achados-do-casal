"use client";

import { usePathname } from "next/navigation";

const GRUPO_WHATSAPP =
  "https://chat.whatsapp.com/DMC6VCIcuMBJMfbfdIk8SZ?s=sh&p=i&ilr=4&amv=0";

export default function WhatsAppGrupoFlutuante() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  return (
    <a
      href={GRUPO_WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Entrar no grupo do Achados do Casal no WhatsApp"
      title="Entrar no grupo do WhatsApp"
      className="group fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-[0_10px_30px_rgba(22,163,74,0.35)] ring-4 ring-white/90 transition hover:-translate-y-1 hover:bg-green-600 focus:outline-none focus:ring-4 focus:ring-green-200 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16"
    >
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="h-8 w-8 fill-current sm:h-9 sm:w-9"
      >
        <path d="M16.04 3C9.39 3 4 8.3 4 14.84c0 2.3.68 4.55 1.96 6.47L4.67 26l4.84-1.25a12.2 12.2 0 0 0 6.52 1.88h.01C22.69 26.63 28 21.33 28 14.8 28 8.28 22.69 3 16.04 3Zm0 21.62h-.01a10.1 10.1 0 0 1-5.14-1.38l-.37-.22-2.87.74.77-2.75-.24-.38a9.75 9.75 0 0 1-1.51-5.2c0-5.38 4.39-9.76 9.79-9.76 5.39 0 9.77 4.36 9.77 9.73 0 5.37-4.39 9.72-9.79 9.72Zm5.37-7.29c-.29-.15-1.73-.85-2-.95-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.14-.17.2-.34.22-.63.08-.29-.15-1.23-.45-2.35-1.44a8.78 8.78 0 0 1-1.63-2.01c-.17-.29-.02-.45.13-.59.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.58-.91-2.16-.24-.58-.49-.5-.66-.51h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.66.61.7.22 1.34.19 1.85.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34Z" />
      </svg>

      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-lg group-hover:block sm:block sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        Entrar no grupo
      </span>
    </a>
  );
}
