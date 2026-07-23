import { atualizarSessao } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};