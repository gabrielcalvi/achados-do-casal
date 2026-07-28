import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = {
  params: Promise<{
    id: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NOME_COOKIE_SESSAO =
  "economize_session";

function limitarTexto(
  valor: string | null,
  limite = 1000
) {
  if (!valor) {
    return null;
  }

  return valor.slice(0, limite);
}

function obterIp(request: NextRequest) {
  const encaminhado =
    request.headers.get("x-forwarded-for");

  if (encaminhado) {
    return encaminhado
      .split(",")[0]
      ?.trim() || null;
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function gerarHashIp(ip: string | null) {
  const salt =
    process.env.ECONOMIZE_IP_HASH_SALT;

  if (!ip || !salt) {
    return null;
  }

  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex");
}

function urlEhSegura(valor: unknown) {
  if (typeof valor !== "string") {
    return false;
  }

  try {
    const url = new URL(valor);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function voltarParaCentral(
  request: NextRequest,
  aviso: string
) {
  const url = new URL("/economize", request.url);

  url.searchParams.set("aviso", aviso);

  return NextResponse.redirect(url, 307);
}

export async function GET(
  request: NextRequest,
  contexto: ContextoRota
) {
  try {
    const { id } = await contexto.params;

    if (!UUID_REGEX.test(id)) {
      return voltarParaCentral(
        request,
        "oferta-invalida"
      );
    }

    const { data: oferta, error } =
      await supabaseAdmin
        .from("economize_ofertas")
        .select(`
          id,
          loja_id,
          status,
          link_destino,
          link_afiliado,
          data_inicio,
          validade,
          loja:economize_lojas!inner (
            id,
            ativa
          )
        `)
        .eq("id", id)
        .eq("status", "ativo")
        .eq("economize_lojas.ativa", true)
        .maybeSingle();

    if (error) {
      console.error(
        "Erro ao localizar oportunidade para redirecionamento:",
        error
      );

      return voltarParaCentral(
        request,
        "erro-ao-localizar"
      );
    }

    if (!oferta) {
      return voltarParaCentral(
        request,
        "oferta-indisponivel"
      );
    }

    const lojaRelacionada = Array.isArray(
      oferta.loja
    )
      ? oferta.loja[0]
      : oferta.loja;

    if (!lojaRelacionada?.ativa) {
      return voltarParaCentral(
        request,
        "loja-indisponivel"
      );
    }

    const agora = Date.now();

    if (oferta.data_inicio) {
      const inicio = new Date(
        oferta.data_inicio
      ).getTime();

      if (
        Number.isNaN(inicio) ||
        inicio > agora
      ) {
        return voltarParaCentral(
          request,
          "oferta-ainda-nao-iniciada"
        );
      }
    }

    if (oferta.validade) {
      const validade = new Date(
        oferta.validade
      ).getTime();

      if (
        Number.isNaN(validade) ||
        validade <= agora
      ) {
        return voltarParaCentral(
          request,
          "oferta-expirada"
        );
      }
    }

    const linkAfiliado =
      typeof oferta.link_afiliado === "string"
        ? oferta.link_afiliado.trim()
        : "";

    const linkDestino =
      typeof oferta.link_destino === "string"
        ? oferta.link_destino.trim()
        : "";

    const destino =
      linkAfiliado || linkDestino;

    if (!urlEhSegura(destino)) {
      console.error(
        "Oferta sem URL segura para redirecionamento:",
        oferta.id
      );

      return voltarParaCentral(
        request,
        "destino-indisponivel"
      );
    }

    const sessaoRecebida =
      request.cookies.get(
        NOME_COOKIE_SESSAO
      )?.value;

    const possuiSessaoValida =
      typeof sessaoRecebida === "string" &&
      UUID_REGEX.test(sessaoRecebida);

    const sessaoId = possuiSessaoValida
      ? sessaoRecebida
      : randomUUID();

    const ip = obterIp(request);
    const ipHash = gerarHashIp(ip);

    const { error: erroClique } =
      await supabaseAdmin
        .from("economize_cliques")
        .insert({
          oferta_id: oferta.id,
          loja_id: oferta.loja_id,
          origem: "central_economize",
          rota: request.nextUrl.pathname,
          referer: limitarTexto(
            request.headers.get("referer")
          ),
          user_agent: limitarTexto(
            request.headers.get("user-agent")
          ),
          sessao_id: sessaoId,
          ip_hash: ipHash,
        });

    if (erroClique) {
      console.error(
        "Erro ao registrar clique da Central Economize:",
        erroClique
      );

      // O erro de estatística não impede
      // o visitante de acessar a oferta.
    }

    const resposta =
      NextResponse.redirect(
        new URL(destino),
        307
      );

    resposta.headers.set(
      "Cache-Control",
      "no-store"
    );

    if (!possuiSessaoValida) {
      resposta.cookies.set({
        name: NOME_COOKIE_SESSAO,
        value: sessaoId,
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return resposta;
  } catch (error) {
    console.error(
      "Erro inesperado no redirecionamento da Central Economize:",
      error
    );

    return voltarParaCentral(
      request,
      "erro-interno"
    );
  }
}