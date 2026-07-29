import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_PERMITIDOS = new Set([
  "pendente",
  "ativo",
  "expirado",
  "inativo",
  "erro",
]);

const TIPOS_DESCONTO_PERMITIDOS =
  new Set([
    "percentual",
    "valor_fixo",
    "frete_gratis",
    "outro",
  ]);

type ContextoRota = {
  params: Promise<{
    id: string;
  }>;
};

type AtualizacaoCupom = {
  loja_id?: unknown;
  status?: unknown;
  codigo?: unknown;
  titulo?: unknown;
  descricao?: unknown;
  regras?: unknown;
  tipo_desconto?: unknown;
  desconto_percentual?: unknown;
  valor_desconto?: unknown;
  pedido_minimo?: unknown;
  limite_desconto?: unknown;
  publico_alvo?: unknown;
  elegibilidade?: unknown;
  limite_por_usuario?: unknown;
  somente_app?: unknown;
  exige_mercado_pago?: unknown;
  data_inicio?: unknown;
  validade?: unknown;
  link_destino?: unknown;
  link_afiliado?: unknown;
  origem?: unknown;
  origem_url?: unknown;
};

function obterMensagemErro(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado no módulo de cupons.";
}

function textoOuNull(
  valor: unknown
): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();

  return texto || null;
}

function numeroOuNull(
  valor: unknown,
  campo: string
): number | null {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    throw new Error(
      `O campo "${campo}" deve ser numérico.`
    );
  }

  if (numero < 0) {
    throw new Error(
      `O campo "${campo}" não pode ser negativo.`
    );
  }

  return numero;
}

function inteiroOuNull(
  valor: unknown,
  campo: string
): number | null {
  const numero = numeroOuNull(
    valor,
    campo
  );

  if (numero === null) {
    return null;
  }

  if (!Number.isInteger(numero)) {
    throw new Error(
      `O campo "${campo}" deve ser um número inteiro.`
    );
  }

  return numero;
}

function booleano(
  valor: unknown
) {
  if (typeof valor === "boolean") {
    return valor;
  }

  if (valor === "true") {
    return true;
  }

  if (valor === "false") {
    return false;
  }

  throw new Error(
    "O valor booleano informado é inválido."
  );
}

function dataOuNull(
  valor: unknown,
  campo: string
): string | null {
  const texto = textoOuNull(valor);

  if (!texto) {
    return null;
  }

  const data = new Date(texto);

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      `O campo "${campo}" possui uma data inválida.`
    );
  }

  return data.toISOString();
}

async function verificarUsuario() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function PATCH(
  request: NextRequest,
  contexto: ContextoRota
) {
  try {
    const user =
      await verificarUsuario();

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

    const { id } =
      await contexto.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Identificador do cupom não informado.",
        },
        {
          status: 400,
        }
      );
    }

    const corpo =
      (await request.json()) as AtualizacaoCupom;

    const atualizacoes: Record<
      string,
      unknown
    > = {};

    if (
      corpo.loja_id !== undefined
    ) {
      const lojaId =
        textoOuNull(corpo.loja_id);

      if (!lojaId) {
        throw new Error(
          'O campo "loja_id" é obrigatório.'
        );
      }

      atualizacoes.loja_id =
        lojaId;
    }

    if (
      corpo.status !== undefined
    ) {
      const status =
        textoOuNull(corpo.status);

      if (
        !status ||
        !STATUS_PERMITIDOS.has(status)
      ) {
        throw new Error(
          "O status informado não é permitido."
        );
      }

      atualizacoes.status =
        status;
    }

    if (
      corpo.codigo !== undefined
    ) {
      atualizacoes.codigo =
        textoOuNull(corpo.codigo);
    }

    if (
      corpo.titulo !== undefined
    ) {
      const titulo =
        textoOuNull(corpo.titulo);

      if (!titulo) {
        throw new Error(
          'O campo "titulo" é obrigatório.'
        );
      }

      atualizacoes.titulo =
        titulo;
    }

    if (
      corpo.descricao !== undefined
    ) {
      atualizacoes.descricao =
        textoOuNull(
          corpo.descricao
        );
    }

    if (
      corpo.regras !== undefined
    ) {
      atualizacoes.regras =
        textoOuNull(corpo.regras);
    }

    if (
      corpo.tipo_desconto !==
      undefined
    ) {
      const tipoDesconto =
        textoOuNull(
          corpo.tipo_desconto
        );

      if (
        !tipoDesconto ||
        !TIPOS_DESCONTO_PERMITIDOS.has(
          tipoDesconto
        )
      ) {
        throw new Error(
          "O tipo de desconto informado não é permitido."
        );
      }

      atualizacoes.tipo_desconto =
        tipoDesconto;
    }

    if (
      corpo.desconto_percentual !==
      undefined
    ) {
      atualizacoes.desconto_percentual =
        numeroOuNull(
          corpo.desconto_percentual,
          "desconto_percentual"
        );
    }

    if (
      corpo.valor_desconto !==
      undefined
    ) {
      atualizacoes.valor_desconto =
        numeroOuNull(
          corpo.valor_desconto,
          "valor_desconto"
        );
    }

    if (
      corpo.pedido_minimo !==
      undefined
    ) {
      atualizacoes.pedido_minimo =
        numeroOuNull(
          corpo.pedido_minimo,
          "pedido_minimo"
        );
    }

    if (
      corpo.limite_desconto !==
      undefined
    ) {
      atualizacoes.limite_desconto =
        numeroOuNull(
          corpo.limite_desconto,
          "limite_desconto"
        );
    }

    if (
      corpo.publico_alvo !==
      undefined
    ) {
      atualizacoes.publico_alvo =
        textoOuNull(
          corpo.publico_alvo
        );
    }

    if (
      corpo.elegibilidade !==
      undefined
    ) {
      atualizacoes.elegibilidade =
        textoOuNull(
          corpo.elegibilidade
        );
    }

    if (
      corpo.limite_por_usuario !==
      undefined
    ) {
      atualizacoes.limite_por_usuario =
        inteiroOuNull(
          corpo.limite_por_usuario,
          "limite_por_usuario"
        );
    }

    if (
      corpo.somente_app !== undefined
    ) {
      atualizacoes.somente_app =
        booleano(
          corpo.somente_app
        );
    }

    if (
      corpo.exige_mercado_pago !==
      undefined
    ) {
      atualizacoes.exige_mercado_pago =
        booleano(
          corpo.exige_mercado_pago
        );
    }

    if (
      corpo.data_inicio !== undefined
    ) {
      atualizacoes.data_inicio =
        dataOuNull(
          corpo.data_inicio,
          "data_inicio"
        );
    }

    if (
      corpo.validade !== undefined
    ) {
      atualizacoes.validade =
        dataOuNull(
          corpo.validade,
          "validade"
        );
    }

    if (
      corpo.link_destino !==
      undefined
    ) {
      atualizacoes.link_destino =
        textoOuNull(
          corpo.link_destino
        );
    }

    if (
      corpo.link_afiliado !==
      undefined
    ) {
      atualizacoes.link_afiliado =
        textoOuNull(
          corpo.link_afiliado
        );
    }

    if (
      corpo.origem !== undefined
    ) {
      atualizacoes.origem =
        textoOuNull(corpo.origem) ??
        "manual";
    }

    if (
      corpo.origem_url !== undefined
    ) {
      atualizacoes.origem_url =
        textoOuNull(
          corpo.origem_url
        );
    }

    if (
      Object.keys(atualizacoes)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhuma alteração foi informada.",
        },
        {
          status: 400,
        }
      );
    }

    const dataInicio =
      atualizacoes.data_inicio;

    const validade =
      atualizacoes.validade;

    if (
      typeof dataInicio === "string" &&
      typeof validade === "string" &&
      new Date(validade).getTime() <
        new Date(dataInicio).getTime()
    ) {
      throw new Error(
        "A validade não pode ser anterior à data de início."
      );
    }

    atualizacoes.updated_at =
      new Date().toISOString();

    const {
      data: cupomAtualizado,
      error: erroAtualizacao,
    } = await supabaseAdmin
      .from("economize_cupons")
      .update(atualizacoes)
      .eq("id", id)
      .select(`
        id,
        loja_id,
        status,
        codigo,
        titulo,
        descricao,
        regras,
        tipo_desconto,
        desconto_percentual,
        valor_desconto,
        pedido_minimo,
        limite_desconto,
        publico_alvo,
        elegibilidade,
        limite_por_usuario,
        somente_app,
        exige_mercado_pago,
        data_inicio,
        validade,
        link_destino,
        link_afiliado,
        origem,
        origem_url,
        dedupe_key,
        dados_brutos,
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

    if (erroAtualizacao) {
      console.error(
        "Erro ao atualizar cupom:",
        erroAtualizacao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível atualizar o cupom.",
          detalhes:
            erroAtualizacao.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!cupomAtualizado) {
      return NextResponse.json(
        {
          error:
            "Cupom não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      mensagem:
        "Cupom atualizado com sucesso.",
      cupom: cupomAtualizado,
    });
  } catch (error) {
    const mensagem =
      obterMensagemErro(error);

    console.error(
      "Erro na atualização do cupom:",
      error
    );

    return NextResponse.json(
      {
        error:
          "A atualização do cupom não foi concluída.",
        detalhes: mensagem,
      },
      {
        status: 400,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  contexto: ContextoRota
) {
  try {
    const user =
      await verificarUsuario();

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

    const { id } =
      await contexto.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Identificador do cupom não informado.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: cupomExcluido,
      error: erroExclusao,
    } = await supabaseAdmin
      .from("economize_cupons")
      .delete()
      .eq("id", id)
      .select("id, codigo, titulo")
      .maybeSingle();

    if (erroExclusao) {
      console.error(
        "Erro ao excluir cupom:",
        erroExclusao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível excluir o cupom.",
          detalhes:
            erroExclusao.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!cupomExcluido) {
      return NextResponse.json(
        {
          error:
            "Cupom não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      mensagem:
        "Cupom excluído com sucesso.",
      cupom: cupomExcluido,
    });
  } catch (error) {
    console.error(
      "Erro na exclusão do cupom:",
      error
    );

    return NextResponse.json(
      {
        error:
          "A exclusão do cupom não foi concluída.",
        detalhes:
          obterMensagemErro(error),
      },
      {
        status: 500,
      }
    );
  }
}