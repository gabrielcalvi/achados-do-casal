import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = {
  params: Promise<{
    id: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
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

export async function PATCH(
  request: NextRequest,
  contexto: ContextoRota
) {
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

    const { id } = await contexto.params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        {
          error: "A oportunidade informada não é válida.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: ofertaAtual,
      error: erroOfertaAtual,
    } = await supabaseAdmin
      .from("economize_ofertas")
      .select(
        "id, loja_id, data_inicio, validade"
      )
      .eq("id", id)
      .maybeSingle();

    if (erroOfertaAtual) {
      console.error(
        "Erro ao localizar oportunidade:",
        erroOfertaAtual
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível localizar a oportunidade.",
        },
        {
          status: 500,
        }
      );
    }

    if (!ofertaAtual) {
      return NextResponse.json(
        {
          error: "Oportunidade não encontrada.",
        },
        {
          status: 404,
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

    const atualizacoes: Record<string, unknown> = {};

    if ("lojaId" in corpo) {
      const lojaId = textoObrigatorio(corpo.lojaId);

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

      const { data: loja, error: erroLoja } =
        await supabaseAdmin
          .from("economize_lojas")
          .select("id, ativa")
          .eq("id", lojaId)
          .maybeSingle();

      if (erroLoja) {
        console.error(
          "Erro ao validar loja:",
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

      atualizacoes.loja_id = lojaId;
    }

    if ("tipo" in corpo) {
      const tipo = textoObrigatorio(corpo.tipo);

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

      atualizacoes.tipo = tipo;
    }

    if ("status" in corpo) {
      const status = textoObrigatorio(corpo.status);

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

      atualizacoes.status = status;
    }

    if ("titulo" in corpo) {
      const titulo = textoObrigatorio(corpo.titulo);

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

      atualizacoes.titulo = titulo;
    }

    const camposTexto: Array<{
      entrada: string;
      coluna: string;
    }> = [
      {
        entrada: "descricao",
        coluna: "descricao",
      },
      {
        entrada: "codigo",
        coluna: "codigo",
      },
      {
        entrada: "categoria",
        coluna: "categoria",
      },
      {
        entrada: "regras",
        coluna: "regras",
      },
    ];

    for (const campo of camposTexto) {
      if (campo.entrada in corpo) {
        atualizacoes[campo.coluna] = textoOuNull(
          corpo[campo.entrada]
        );
      }
    }

    if ("linkDestino" in corpo) {
      const linkDestino = textoObrigatorio(
        corpo.linkDestino
      );

      if (
        !linkDestino ||
        !urlEhValida(linkDestino)
      ) {
        return NextResponse.json(
          {
            error:
              "Informe um link de destino válido.",
          },
          {
            status: 400,
          }
        );
      }

      atualizacoes.link_destino = linkDestino;
    }

    const camposUrlOpcionais: Array<{
      entrada: string;
      coluna: string;
      rotulo: string;
    }> = [
      {
        entrada: "linkAfiliado",
        coluna: "link_afiliado",
        rotulo: "O link de afiliado",
      },
      {
        entrada: "imagemUrl",
        coluna: "imagem_url",
        rotulo: "O endereço da imagem",
      },
      {
        entrada: "origemUrl",
        coluna: "origem_url",
        rotulo: "O link da origem",
      },
    ];

    for (const campo of camposUrlOpcionais) {
      if (campo.entrada in corpo) {
        const valor = textoOuNull(
          corpo[campo.entrada]
        );

        if (valor && !urlEhValida(valor)) {
          return NextResponse.json(
            {
              error: `${campo.rotulo} não é válido.`,
            },
            {
              status: 400,
            }
          );
        }

        atualizacoes[campo.coluna] = valor;
      }
    }

    const camposNumericos: Array<{
      entrada: string;
      coluna: string;
    }> = [
      {
        entrada: "descontoPercentual",
        coluna: "desconto_percentual",
      },
      {
        entrada: "valorDesconto",
        coluna: "valor_desconto",
      },
      {
        entrada: "cashbackPercentual",
        coluna: "cashback_percentual",
      },
      {
        entrada: "pedidoMinimo",
        coluna: "pedido_minimo",
      },
      {
        entrada: "precoOriginal",
        coluna: "preco_original",
      },
      {
        entrada: "precoOferta",
        coluna: "preco_oferta",
      },
    ];

    for (const campo of camposNumericos) {
      if (campo.entrada in corpo) {
        const valor = normalizarNumero(
          corpo[campo.entrada]
        );

        if (valor === undefined) {
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

        atualizacoes[campo.coluna] = valor;
      }
    }

    let novaDataInicio:
      | string
      | null
      | undefined = ofertaAtual.data_inicio;

    let novaValidade:
      | string
      | null
      | undefined = ofertaAtual.validade;

    if ("dataInicio" in corpo) {
      novaDataInicio = normalizarData(
        corpo.dataInicio
      );

      if (novaDataInicio === undefined) {
        return NextResponse.json(
          {
            error: "A data de início não é válida.",
          },
          {
            status: 400,
          }
        );
      }

      atualizacoes.data_inicio = novaDataInicio;
    }

    if ("validade" in corpo) {
      novaValidade = normalizarData(corpo.validade);

      if (novaValidade === undefined) {
        return NextResponse.json(
          {
            error: "A validade informada não é válida.",
          },
          {
            status: 400,
          }
        );
      }

      atualizacoes.validade = novaValidade;
    }

    if (
      novaDataInicio &&
      novaValidade &&
      new Date(novaValidade).getTime() <=
        new Date(novaDataInicio).getTime()
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

    if ("destaque" in corpo) {
      if (typeof corpo.destaque !== "boolean") {
        return NextResponse.json(
          {
            error:
              "O campo de destaque não é válido.",
          },
          {
            status: 400,
          }
        );
      }

      atualizacoes.destaque = corpo.destaque;
    }

    if ("selos" in corpo) {
      atualizacoes.selos = normalizarSelos(
        corpo.selos
      );
    }

    if (Object.keys(atualizacoes).length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhuma alteração válida foi informada.",
        },
        {
          status: 400,
        }
      );
    }

    atualizacoes.verificado_em =
      new Date().toISOString();

    const { data: oferta, error } =
      await supabaseAdmin
        .from("economize_ofertas")
        .update(atualizacoes)
        .eq("id", id)
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
        .maybeSingle();

    if (error) {
      console.error(
        "Erro ao atualizar oportunidade:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível atualizar a oportunidade.",
        },
        {
          status: 500,
        }
      );
    }

    if (!oferta) {
      return NextResponse.json(
        {
          error: "Oportunidade não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      mensagem:
        "Oportunidade atualizada com sucesso.",
      oferta,
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao atualizar oportunidade:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao atualizar a oportunidade.",
      },
      {
        status: 500,
      }
    );
  }
}