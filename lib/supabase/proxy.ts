import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "As variáveis públicas do Supabase não foram configuradas."
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesParaSalvar) {
        cookiesParaSalvar.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        resposta = NextResponse.next({
          request,
        });

        cookiesParaSalvar.forEach(({ name, value, options }) => {
          resposta.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;

  const acessandoAdmin = caminho.startsWith("/admin");
  const acessandoLogin = caminho === "/login";

  if (!user && acessandoAdmin) {
    const urlLogin = request.nextUrl.clone();
    urlLogin.pathname = "/login";

    return NextResponse.redirect(urlLogin);
  }

  if (user && acessandoLogin) {
    const urlAdmin = request.nextUrl.clone();
    urlAdmin.pathname = "/admin";

    return NextResponse.redirect(urlAdmin);
  }

  return resposta;
}