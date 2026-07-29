import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = new Set([
  "cupom",
  "cashback",
  "promocao",
  "campanha",
  "frete_gratis",
]);

const STATUS_PERMITIDOS = new Set([
  "pendente",
  "ativo",
  "expirado",
  "inativo",
  "erro",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function textoObrigatorio(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoOuNull(valor: unknown) {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();

  return texto || null;
}

function urlEhValida(valor: string) {
  try {
    const url = new URL(valor);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizarNumero(
  valor: unknown
): number | null | undefined {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  let texto = String(valor)
    .trim()
    .replace(/[^\d,.-]/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);

  if (!Number.isFinite(numero) || numero < 0) {
    return undefined;
  }

  return numero;
}

function normalizarData(
  valor: unknown
): string | null | undefined {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const data = new Date(String(valor));

  if (Number.isNaN(data.getTime())) {
    return undefined;
  }

  return data.toISOString();
}

function normalizarSelos(valor: unknown) {
  if (!Array.isArray(valor)) {
    return [];
  }

  return Array.from(
    new Set(
      valor
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const usuario = await obterUsuarioAutenticado();

    if (!usuario) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const lojaId =
      request.nextUrl.searchParams.get("loja_id");
    const tipo =
      request.nextUrl.searchParams.get("tipo");
    const status =
      request.nextUrl.searchParams.get("status");

    if (lojaId && !UUID_REGEX.test(lojaId)) {
      return NextResponse.json(
        {
          error: "A loja informada não é válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (tipo && !TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json(
        {
          error: "O tipo informado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (status && !STATUS_PERMITIDOS.has(status)) {
      return NextResponse.json(
        {
          error: "O status informado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    let consulta = supabaseAdmin
      .from("economize_ofertas")
      .select(`
        id,
        loja_id,
        tipo,
        status,
        titulo,
        descricao,
        codigo,
        categoria,
        regras,
        imagem_url,
        link_destino,
        link_afiliado,
        desconto_percentual,
        valor_desconto,
        cashback_percentual,
        pedido_minimo,
        preco_original,
        preco_oferta,
        data_inicio,
        validade,
        destaque,
        selos,
        origem,
        origem_url,
        coletado_em,
        verificado_em,
        created_at,
        updated_at,
        loja:economize_lojas (
          id,
          nome,
          slug,
          dominio,
          logo_url
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (lojaId) {
      consulta = consulta.eq("loja_id", lojaId);
    }

    if (tipo) {
      consulta = consulta.eq("tipo", tipo);
    }

    if (status) {
      consulta = consulta.eq("status", status);
    }

    const { data: ofertas, error } = await consulta;

    if (error) {
      console.error(
        "Erro ao listar oportunidades da Central Economize:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar as oportunidades.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ofertas: ofertas ?? [],
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao listar oportunidades:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao carregar as oportunidades.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await obterUsuarioAutenticado();

    if (!usuario) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    let corpo: Record<string, unknown>;

    try {
      corpo = (await request.json()) as Record<
        string,
        unknown
      >;
    } catch {
      return NextResponse.json(
        {
          error: "O conteúdo enviado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    const lojaId = textoObrigatorio(corpo.lojaId);
    const tipo = textoObrigatorio(corpo.tipo);
    const titulo = textoObrigatorio(corpo.titulo);
    const status =
      textoObrigatorio(corpo.status) || "ativo";
    const linkDestino = textoObrigatorio(
      corpo.linkDestino
    );

    if (!UUID_REGEX.test(lojaId)) {
      return NextResponse.json(
        {
          error: "Selecione uma loja válida.",
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
            "Selecione um tipo válido de oportunidade.",
        },
        {
          status: 400,
        }
      );
    }

    if (!STATUS_PERMITIDOS.has(status)) {
      return NextResponse.json(
        {
          error: "Selecione um status válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!titulo) {
      return NextResponse.json(
        {
          error: "Informe o título da oportunidade.",
        },
        {
          status: 400,
        }
      );
    }

    if (titulo.length > 180) {
      return NextResponse.json(
        {
          error:
            "O título deve ter no máximo 180 caracteres.",
        },
        {
          status: 400,
        }
      );
    }

    if (!linkDestino || !urlEhValida(linkDestino)) {
      return NextResponse.json(
        {
          error:
            "Informe um link de destino válido, começando com http ou https.",
        },
        {
          status: 400,
        }
      );
    }

    const linkAfiliado = textoOuNull(
      corpo.linkAfiliado
    );
    const imagemUrl = textoOuNull(corpo.imagemUrl);
    const origemUrl = textoOuNull(corpo.origemUrl);

    if (
      linkAfiliado &&
      !urlEhValida(linkAfiliado)
    ) {
      return NextResponse.json(
        {
          error: "O link de afiliado não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (imagemUrl && !urlEhValida(imagemUrl)) {
      return NextResponse.json(
        {
          error: "O endereço da imagem não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (origemUrl && !urlEhValida(origemUrl)) {
      return NextResponse.json(
        {
          error: "O link da origem não é válido.",
        },
        {
          status: 400,
        }
      );
    }

    const camposNumericos = {
      descontoPercentual: normalizarNumero(
        corpo.descontoPercentual
      ),
      valorDesconto: normalizarNumero(
        corpo.valorDesconto
      ),
      cashbackPercentual: normalizarNumero(
        corpo.cashbackPercentual
      ),
      pedidoMinimo: normalizarNumero(
        corpo.pedidoMinimo
      ),
      precoOriginal: normalizarNumero(
        corpo.precoOriginal
      ),
      precoOferta: normalizarNumero(
        corpo.precoOferta
      ),
    };

    const campoNumericoInvalido = Object.entries(
      camposNumericos
    ).find(([, valor]) => valor === undefined);

    if (campoNumericoInvalido) {
      return NextResponse.json(
        {
          error:
            "Os valores e percentuais devem ser números iguais ou maiores que zero.",
        },
        {
          status: 400,
        }
      );
    }

    const dataInicio = normalizarData(
      corpo.dataInicio
    );
    const validade = normalizarData(corpo.validade);

    if (dataInicio === undefined) {
      return NextResponse.json(
        {
          error: "A data de início não é válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (validade === undefined) {
      return NextResponse.json(
        {
          error: "A validade informada não é válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      dataInicio &&
      validade &&
      new Date(validade).getTime() <=
        new Date(dataInicio).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "A validade deve ser posterior à data de início.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: loja, error: erroLoja } =
      await supabaseAdmin
        .from("economize_lojas")
        .select("id, nome, ativa")
        .eq("id", lojaId)
        .maybeSingle();

    if (erroLoja) {
      console.error(
        "Erro ao validar loja da Central Economize:",
        erroLoja
      );

      return NextResponse.json(
        {
          error: "Não foi possível validar a loja.",
        },
        {
          status: 500,
        }
      );
    }

    if (!loja || !loja.ativa) {
      return NextResponse.json(
        {
          error:
            "A loja selecionada não está disponível.",
        },
        {
          status: 400,
        }
      );
    }

    const agora = new Date().toISOString();

    const { data: oferta, error } =
      await supabaseAdmin
        .from("economize_ofertas")
        .insert({
          loja_id: lojaId,
          tipo,
          status,
          titulo,
          descricao: textoOuNull(corpo.descricao),
          codigo: textoOuNull(corpo.codigo),
          categoria: textoOuNull(corpo.categoria),
          regras: textoOuNull(corpo.regras),
          imagem_url: imagemUrl,
          link_destino: linkDestino,
          link_afiliado: linkAfiliado,
          desconto_percentual:
            camposNumericos.descontoPercentual,
          valor_desconto:
            camposNumericos.valorDesconto,
          cashback_percentual:
            camposNumericos.cashbackPercentual,
          pedido_minimo:
            camposNumericos.pedidoMinimo,
          preco_original:
            camposNumericos.precoOriginal,
          preco_oferta:
            camposNumericos.precoOferta,
          data_inicio: dataInicio,
          validade,
          destaque: corpo.destaque === true,
          selos: normalizarSelos(corpo.selos),
          origem: "manual",
          origem_url: origemUrl,
          dados_brutos: {},
          verificado_em: agora,
        })
        .select(`
          id,
          loja_id,
          tipo,
          status,
          titulo,
          descricao,
          codigo,
          categoria,
          regras,
          imagem_url,
          link_destino,
          link_afiliado,
          desconto_percentual,
          valor_desconto,
          cashback_percentual,
          pedido_minimo,
          preco_original,
          preco_oferta,
          data_inicio,
          validade,
          destaque,
          selos,
          origem,
          origem_url,
          verificado_em,
          created_at,
          updated_at,
          loja:economize_lojas (
            id,
            nome,
            slug,
            dominio,
            logo_url
          )
        `)
        .single();

    if (error) {
      console.error(
        "Erro ao cadastrar oportunidade:",
        error
      );

      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Essa oportunidade já está cadastrada.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "Não foi possível cadastrar a oportunidade.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        mensagem:
          "Oportunidade cadastrada com sucesso.",
        oferta,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao cadastrar oportunidade:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao cadastrar a oportunidade.",
      },
      {
        status: 500,
      }
    );
  }
}