import { atualizarSessao } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/api/debug/:path*", "/api/teste-monitor", "/api/mercadolivre/login", "/api/mercadolivre/me", "/api/mercadolivre/refresh", "/api/mercadolivre/teste", "/api/mercadolivre/refresh-teste"],
};