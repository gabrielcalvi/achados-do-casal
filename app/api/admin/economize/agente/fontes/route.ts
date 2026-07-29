import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = new Set([
  "pagina",
  "api",
  "feed",
  "afiliado",
  "manual",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CorpoNovaFonte = {
  lojaId?: unknown;
  nome?: unknown;
  tipo?: unknown;
  url?: unknown;
  ativa?: unknown;
  prioridade?: unknown;
  intervaloMinutos?: unknown;
  configuracao?: unknown;
};

function objetoSimples(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function urlValida(valor: string) {
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

async function obterUsuarioAutenticado() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const user =
      await obterUsuarioAutenticado();

    if (!user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: fontes,
      error,
    } = await supabaseAdmin
      .from("economize_fontes")
      .select(`
        id,
        loja_id,
        nome,
        tipo,
        url,
        ativa,
        prioridade,
        intervalo_minutos,
        ultima_execucao_em,
        proxima_execucao_em,
        configuracao,
        created_at,
        updated_at,
        loja:economize_lojas (
          id,
          nome,
          slug,
          ativa,
          ordem
        )
      `)
      .order("prioridade", {
        ascending: true,
      })
      .order("nome", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Erro ao carregar fontes do Agente de Economia:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar as fontes.",
        },
        {
          status: 500,
        }
      );
    }

    const fontesNormalizadas = (
      fontes ?? []
    ).map((fonte) => {
      const lojaRelacionada =
        Array.isArray(fonte.loja)
          ? fonte.loja[0] ?? null
          : fonte.loja ?? null;

      return {
        id: fonte.id,
        loja_id: fonte.loja_id,
        nome: fonte.nome,
        tipo: fonte.tipo,
        url: fonte.url,
        ativa: fonte.ativa,
        prioridade: fonte.prioridade,
        intervalo_minutos:
          fonte.intervalo_minutos,
        ultima_execucao_em:
          fonte.ultima_execucao_em,
        proxima_execucao_em:
          fonte.proxima_execucao_em,
        configuracao:
          fonte.configuracao ?? {},
        created_at: fonte.created_at,
        updated_at: fonte.updated_at,
        loja: lojaRelacionada,
      };
    });

    return NextResponse.json(
      {
        fontes: fontesNormalizadas,
        total: fontesNormalizadas.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao listar fontes:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar as fontes.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const user =
      await obterUsuarioAutenticado();

    if (!user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    let corpo: CorpoNovaFonte;

    try {
      corpo =
        (await request.json()) as CorpoNovaFonte;
    } catch {
      return NextResponse.json(
        {
          error:
            "O corpo da requisição não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    const lojaId =
      typeof corpo.lojaId === "string"
        ? corpo.lojaId.trim()
        : "";

    const nome =
      typeof corpo.nome === "string"
        ? corpo.nome.trim()
        : "";

    const tipo =
      typeof corpo.tipo === "string"
        ? corpo.tipo.trim()
        : "";

    const urlRecebida =
      typeof corpo.url === "string"
        ? corpo.url.trim()
        : "";

    if (!UUID_REGEX.test(lojaId)) {
      return NextResponse.json(
        {
          error:
            "Selecione uma loja válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      nome.length < 3 ||
      nome.length > 150
    ) {
      return NextResponse.json(
        {
          error:
            "O nome da fonte deve possuir entre 3 e 150 caracteres.",
        },
        {
          status: 400,
        }
      );
    }

    if (!TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json(
        {
          error:
            "O tipo da fonte não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      tipo !== "manual" &&
      !urlRecebida
    ) {
      return NextResponse.json(
        {
          error:
            "Informe a URL da fonte.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      urlRecebida &&
      !urlValida(urlRecebida)
    ) {
      return NextResponse.json(
        {
          error:
            "A URL deve começar com http:// ou https://.",
        },
        {
          status: 400,
        }
      );
    }

    const prioridade =
      corpo.prioridade === undefined
        ? 100
        : Number(corpo.prioridade);

    if (
      !Number.isInteger(prioridade) ||
      prioridade < 1
    ) {
      return NextResponse.json(
        {
          error:
            "A prioridade deve ser um número inteiro maior ou igual a 1.",
        },
        {
          status: 400,
        }
      );
    }

    const intervaloMinutos =
      corpo.intervaloMinutos === undefined
        ? 360
        : Number(
            corpo.intervaloMinutos
          );

    if (
      !Number.isInteger(
        intervaloMinutos
      ) ||
      intervaloMinutos < 15
    ) {
      return NextResponse.json(
        {
          error:
            "O intervalo deve ser de pelo menos 15 minutos.",
        },
        {
          status: 400,
        }
      );
    }

    const ativa =
      typeof corpo.ativa === "boolean"
        ? corpo.ativa
        : true;

    let configuracao: Record<
      string,
      unknown
    > = {};

    if (
      corpo.configuracao !== undefined
    ) {
      if (
        !objetoSimples(
          corpo.configuracao
        )
      ) {
        return NextResponse.json(
          {
            error:
              "A configuração da fonte deve ser um objeto válido.",
          },
          {
            status: 400,
          }
        );
      }

      configuracao =
        corpo.configuracao;
    }

    const {
      data: loja,
      error: erroLoja,
    } = await supabaseAdmin
      .from("economize_lojas")
      .select(
        "id, nome, slug, ativa"
      )
      .eq("id", lojaId)
      .maybeSingle();

    if (erroLoja) {
      console.error(
        "Erro ao validar loja da fonte:",
        erroLoja
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível validar a loja.",
        },
        {
          status: 500,
        }
      );
    }

    if (!loja) {
      return NextResponse.json(
        {
          error:
            "A loja informada não foi encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const agora =
      new Date().toISOString();

    const {
      data: fonteCriada,
      error: erroCriacao,
    } = await supabaseAdmin
      .from("economize_fontes")
      .insert({
        loja_id: lojaId,
        nome,
        tipo,
        url: urlRecebida || null,
        ativa,
        prioridade,
        intervalo_minutos:
          intervaloMinutos,
        configuracao,
        updated_at: agora,
      })
      .select(`
        id,
        loja_id,
        nome,
        tipo,
        url,
        ativa,
        prioridade,
        intervalo_minutos,
        ultima_execucao_em,
        proxima_execucao_em,
        configuracao,
        created_at,
        updated_at
      `)
      .single();

    if (erroCriacao) {
      if (
        erroCriacao.code === "23505"
      ) {
        return NextResponse.json(
          {
            error:
              "Essa fonte já está cadastrada para a loja selecionada.",
          },
          {
            status: 409,
          }
        );
      }

      console.error(
        "Erro ao cadastrar fonte do Agente de Economia:",
        erroCriacao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível cadastrar a fonte.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        mensagem:
          "Fonte cadastrada com sucesso.",
        fonte: {
          ...fonteCriada,
          loja,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao cadastrar fonte:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao cadastrar a fonte.",
      },
      {
        status: 500,
      }
    );
  }
}