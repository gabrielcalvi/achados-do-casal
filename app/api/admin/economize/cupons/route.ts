import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createHash } from "node:crypto";
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NovoCupom = {
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
  oferta_ids?: unknown;
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

function textoObrigatorio(
  valor: unknown,
  campo: string
) {
  const texto = textoOuNull(valor);

  if (!texto) {
    throw new Error(
      `O campo "${campo}" é obrigatório.`
    );
  }

  return texto;
}

function listaIdsUuid(
  valor: unknown,
  campo: string
) {
  if (valor === undefined || valor === null) {
    return [] as string[];
  }

  if (!Array.isArray(valor)) {
    throw new Error(
      `O campo "${campo}" deve ser uma lista.`
    );
  }

  const ids = Array.from(
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

  const invalido = ids.find(
    (id) => !UUID_REGEX.test(id)
  );

  if (invalido) {
    throw new Error(
      `O campo "${campo}" possui um ID inválido.`
    );
  }

  return ids;
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
  valor: unknown,
  padrao = false
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

  return padrao;
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

function criarDedupeKey({
  lojaId,
  codigo,
  titulo,
  validade,
}: {
  lojaId: string;
  codigo: string | null;
  titulo: string;
  validade: string | null;
}) {
  if (codigo) {
    return `cupom:${codigo
      .trim()
      .toUpperCase()}`;
  }

  const hash = createHash("sha256")
    .update(
      [
        lojaId,
        titulo.toLowerCase(),
        validade ?? "sem-validade",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);

  return `cupom:${hash}`;
}

function obterLimite(
  request: NextRequest
) {
  const valor = Number(
    request.nextUrl.searchParams.get(
      "limite"
    )
  );

  if (!Number.isInteger(valor)) {
    return 100;
  }

  return Math.min(
    Math.max(valor, 1),
    500
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const limite =
      obterLimite(request);

    const status = textoOuNull(
      request.nextUrl.searchParams.get(
        "status"
      )
    );

    const lojaId = textoOuNull(
      request.nextUrl.searchParams.get(
        "loja_id"
      )
    );

    let consulta = supabaseAdmin
      .from("economize_cupons")
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
      .order("created_at", {
        ascending: false,
      })
      .limit(limite);

    if (status) {
      consulta = consulta.eq(
        "status",
        status
      );
    }

    if (lojaId) {
      consulta = consulta.eq(
        "loja_id",
        lojaId
      );
    }

    const {
      data: cupons,
      error: erroCupons,
    } = await consulta;

    if (erroCupons) {
      console.error(
        "Erro ao listar cupons:",
        erroCupons
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar os cupons.",
        },
        {
          status: 500,
        }
      );
    }

    const cuponsLista = cupons ?? [];
    const idsCupons = cuponsLista.map(
      (cupom) => cupom.id
    );

    let ofertaIdsPorCupom =
      new Map<string, string[]>();

    if (idsCupons.length > 0) {
      const {
        data: vinculos,
        error: erroVinculos,
      } = await supabaseAdmin
        .from("economize_cupons_ofertas")
        .select("cupom_id, oferta_id")
        .in("cupom_id", idsCupons);

      if (erroVinculos) {
        console.error(
          "Erro ao carregar vínculos dos cupons:",
          erroVinculos
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível carregar os vínculos dos cupons.",
          },
          {
            status: 500,
          }
        );
      }

      for (const vinculo of vinculos ?? []) {
        const atuais =
          ofertaIdsPorCupom.get(
            vinculo.cupom_id
          ) ?? [];

        atuais.push(vinculo.oferta_id);

        ofertaIdsPorCupom.set(
          vinculo.cupom_id,
          atuais
        );
      }
    }

    const cuponsComOfertas =
      cuponsLista.map((cupom) => ({
        ...cupom,
        oferta_ids:
          ofertaIdsPorCupom.get(
            cupom.id
          ) ?? [],
      }));

    return NextResponse.json({
      cupons: cuponsComOfertas,
      total: cuponsComOfertas.length,
    });
  } catch (error) {
    console.error(
      "Erro na listagem de cupons:",
      error
    );

    return NextResponse.json(
      {
        error:
          "A listagem de cupons não foi concluída.",
        detalhes:
          obterMensagemErro(error),
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
    const supabase =
      await createClient();

    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const corpo =
      (await request.json()) as NovoCupom;

    const ofertaIds = listaIdsUuid(
      corpo.oferta_ids,
      "oferta_ids"
    );

    const lojaId =
      textoObrigatorio(
        corpo.loja_id,
        "loja_id"
      );

    if (ofertaIds.length > 0) {
      const {
        data: ofertasVinculadas,
        error: erroOfertasVinculadas,
      } = await supabaseAdmin
        .from("economize_ofertas")
        .select("id, loja_id")
        .in("id", ofertaIds);

      if (erroOfertasVinculadas) {
        throw new Error(
          "Não foi possível validar as ofertas vinculadas."
        );
      }

      if (
        (ofertasVinculadas?.length ?? 0) !==
        ofertaIds.length
      ) {
        throw new Error(
          "Uma ou mais ofertas vinculadas não existem."
        );
      }

      const ofertaDeOutraLoja =
        ofertasVinculadas?.find(
          (oferta) =>
            oferta.loja_id !== lojaId
        );

      if (ofertaDeOutraLoja) {
        throw new Error(
          "O cupom só pode ser vinculado a ofertas da mesma loja."
        );
      }
    }

    const titulo =
      textoObrigatorio(
        corpo.titulo,
        "titulo"
      );

    const tipoDesconto =
      textoObrigatorio(
        corpo.tipo_desconto,
        "tipo_desconto"
      );

    if (
      !TIPOS_DESCONTO_PERMITIDOS.has(
        tipoDesconto
      )
    ) {
      throw new Error(
        "O tipo de desconto informado não é permitido."
      );
    }

    const status =
      textoOuNull(corpo.status) ??
      "pendente";

    if (
      !STATUS_PERMITIDOS.has(status)
    ) {
      throw new Error(
        "O status informado não é permitido."
      );
    }

    const codigo =
      textoOuNull(corpo.codigo);

    const dataInicio =
      dataOuNull(
        corpo.data_inicio,
        "data_inicio"
      );

    const validade =
      dataOuNull(
        corpo.validade,
        "validade"
      );

    if (
      dataInicio &&
      validade &&
      new Date(validade).getTime() <
        new Date(dataInicio).getTime()
    ) {
      throw new Error(
        "A validade não pode ser anterior à data de início."
      );
    }

    const descontoPercentual =
      numeroOuNull(
        corpo.desconto_percentual,
        "desconto_percentual"
      );

    const valorDesconto =
      numeroOuNull(
        corpo.valor_desconto,
        "valor_desconto"
      );

    if (
      tipoDesconto === "percentual" &&
      descontoPercentual === null
    ) {
      throw new Error(
        "Informe o percentual do desconto."
      );
    }

    if (
      tipoDesconto === "valor_fixo" &&
      valorDesconto === null
    ) {
      throw new Error(
        "Informe o valor fixo do desconto."
      );
    }

    const dedupeKey =
      criarDedupeKey({
        lojaId,
        codigo,
        titulo,
        validade,
      });

    const agora =
      new Date().toISOString();

    const {
      data: cupomCriado,
      error: erroCriacao,
    } = await supabaseAdmin
      .from("economize_cupons")
      .insert({
        loja_id: lojaId,
        status,
        codigo,
        titulo,
        descricao:
          textoOuNull(
            corpo.descricao
          ),
        regras:
          textoOuNull(corpo.regras),
        tipo_desconto:
          tipoDesconto,
        desconto_percentual:
          descontoPercentual,
        valor_desconto:
          valorDesconto,
        pedido_minimo:
          numeroOuNull(
            corpo.pedido_minimo,
            "pedido_minimo"
          ),
        limite_desconto:
          numeroOuNull(
            corpo.limite_desconto,
            "limite_desconto"
          ),
        publico_alvo:
          textoOuNull(
            corpo.publico_alvo
          ),
        elegibilidade:
          textoOuNull(
            corpo.elegibilidade
          ),
        limite_por_usuario:
          inteiroOuNull(
            corpo.limite_por_usuario,
            "limite_por_usuario"
          ),
        somente_app:
          booleano(
            corpo.somente_app
          ),
        exige_mercado_pago:
          booleano(
            corpo.exige_mercado_pago
          ),
        data_inicio:
          dataInicio,
        validade,
        link_destino:
          textoOuNull(
            corpo.link_destino
          ),
        link_afiliado:
          textoOuNull(
            corpo.link_afiliado
          ),
        origem:
          textoOuNull(
            corpo.origem
          ) ?? "manual",
        origem_url:
          textoOuNull(
            corpo.origem_url
          ),
        dedupe_key:
          dedupeKey,
        dados_brutos: {
          criado_por:
            user.id,
          cadastro:
            "painel_administrativo",
        },
        coletado_em: agora,
        verificado_em: agora,
      })
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
              "Este cupom já está cadastrado para essa loja.",
          },
          {
            status: 409,
          }
        );
      }

      console.error(
        "Erro ao cadastrar cupom:",
        erroCriacao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível cadastrar o cupom.",
          detalhes:
            erroCriacao.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      cupomCriado &&
      ofertaIds.length > 0
    ) {
      const { error: erroVinculo } =
        await supabaseAdmin
          .from(
            "economize_cupons_ofertas"
          )
          .insert(
            ofertaIds.map((ofertaId) => ({
              cupom_id: cupomCriado.id,
              oferta_id: ofertaId,
            }))
          );

      if (erroVinculo) {
        console.error(
          "Erro ao vincular cupom às ofertas:",
          erroVinculo
        );

        await supabaseAdmin
          .from("economize_cupons")
          .delete()
          .eq("id", cupomCriado.id);

        return NextResponse.json(
          {
            error:
              "O cupom foi validado, mas o vínculo com as ofertas não pôde ser salvo.",
            detalhes:
              erroVinculo.message,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json(
      {
        mensagem:
          "Cupom cadastrado com sucesso.",
        cupom: {
          ...cupomCriado,
          oferta_ids: ofertaIds,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const mensagem =
      obterMensagemErro(error);

    console.error(
      "Erro no cadastro de cupom:",
      error
    );

    return NextResponse.json(
      {
        error:
          "O cadastro do cupom não foi concluído.",
        detalhes: mensagem,
      },
      {
        status:
          mensagem.includes(
            "obrigatório"
          ) ||
          mensagem.includes(
            "inválida"
          ) ||
          mensagem.includes(
            "Informe"
          ) ||
          mensagem.includes(
            "permitido"
          ) ||
          mensagem.includes(
            "anterior"
          )
            ? 400
            : 500,
      }
    );
  }
}