import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  mensagemErroProcessamentoMercadoLivre,
  processarFonteMercadoLivre,
  type FonteMercadoLivre,
} from "@/lib/economize/processadores/mercadoLivre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LojaRelacionada = {
  id: string;
  nome: string;
  slug: string;
  ordem: number;
  ativa: boolean;
};

type FonteAtiva = {
  id: string;
  loja_id: string;
  nome: string;
  tipo: string;
  url: string | null;
  ativa: boolean;
  prioridade: number;
  intervalo_minutos: number;
  configuracao: Record<string, unknown>;
  loja:
    | LojaRelacionada
    | LojaRelacionada[]
    | null;
};

type ResultadoFonte = {
  fonte_id: string;
  fonte_nome: string;
  loja_id: string;
  loja_nome: string;
  tipo: string;
  url: string | null;
  modo:
    | "extracao"
    | "consulta"
    | "manual";
  consultada: boolean;
  sucesso: boolean;
  status_http: number | null;
  content_type: string | null;
  duracao_ms: number;
  mensagem: string;
  ofertas_encontradas: number;
  ofertas_novas: number;
  ofertas_atualizadas: number;
  ofertas_sem_alteracao: number;
  total_erros: number;
  erros: string[];
};

function obterMensagemErro(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado durante a execução do agente.";
}

function normalizarLoja(
  loja: FonteAtiva["loja"]
): LojaRelacionada | null {
  if (Array.isArray(loja)) {
    return loja[0] ?? null;
  }

  return loja;
}

function calcularProximaExecucao(
  intervaloMinutos: number
) {
  return new Date(
    Date.now() +
      intervaloMinutos * 60 * 1000
  ).toISOString();
}

function ehFonteMercadoLivre(
  fonte: FonteAtiva
) {
  if (!fonte.url) {
    return false;
  }

  try {
    const url = new URL(fonte.url);

    return (
      url.hostname
        .toLowerCase()
        .includes("mercadolivre.com.br") &&
      url.pathname
        .toLowerCase()
        .startsWith("/ofertas")
    );
  } catch {
    return false;
  }
}

function criarResultadoBase(
  fonte: FonteAtiva
) {
  const loja = normalizarLoja(
    fonte.loja
  );

  return {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    loja_id: fonte.loja_id,
    loja_nome:
      loja?.nome ??
      "Loja não identificada",
    tipo: fonte.tipo,
    url: fonte.url,
  };
}

async function consultarFonteGenerica(
  fonte: FonteAtiva
): Promise<ResultadoFonte> {
  const resultadoBase =
    criarResultadoBase(fonte);

  if (fonte.tipo === "manual") {
    return {
      ...resultadoBase,
      modo: "manual",
      consultada: false,
      sucesso: true,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem:
        "Fonte manual registrada sem consulta automática.",
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 0,
      erros: [],
    };
  }

  if (!fonte.url) {
    return {
      ...resultadoBase,
      modo: "consulta",
      consultada: false,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem:
        "A fonte não possui uma URL cadastrada.",
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 1,
      erros: [
        "A fonte não possui uma URL cadastrada.",
      ],
    };
  }

  const inicio = Date.now();

  const controlador =
    new AbortController();

  const temporizador = setTimeout(() => {
    controlador.abort();
  }, 20000);

  try {
    const resposta = await fetch(
      fonte.url,
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controlador.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "pt-BR,pt;q=0.9,en;q=0.8",

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
        },
      }
    );

    const contentType =
      resposta.headers.get(
        "content-type"
      );

    const duracaoMs = Math.max(
      Date.now() - inicio,
      1
    );

    if (resposta.body) {
      await resposta.body.cancel();
    }

    if (!resposta.ok) {
      const mensagem =
        `A fonte respondeu com HTTP ${resposta.status}.`;

      return {
        ...resultadoBase,
        modo: "consulta",
        consultada: true,
        sucesso: false,
        status_http:
          resposta.status,
        content_type:
          contentType,
        duracao_ms: duracaoMs,
        mensagem,
        ofertas_encontradas: 0,
        ofertas_novas: 0,
        ofertas_atualizadas: 0,
        ofertas_sem_alteracao: 0,
        total_erros: 1,
        erros: [mensagem],
      };
    }

    return {
      ...resultadoBase,
      modo: "consulta",
      consultada: true,
      sucesso: true,
      status_http:
        resposta.status,
      content_type:
        contentType,
      duracao_ms: duracaoMs,
      mensagem:
        "Fonte acessada com sucesso. Ainda não existe um extrator configurado para ela.",
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 0,
      erros: [],
    };
  } catch (error) {
    const duracaoMs = Math.max(
      Date.now() - inicio,
      1
    );

    const mensagem =
      error instanceof Error &&
      error.name === "AbortError"
        ? "A consulta excedeu o limite de 20 segundos."
        : obterMensagemErro(error);

    return {
      ...resultadoBase,
      modo: "consulta",
      consultada: true,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: duracaoMs,
      mensagem,
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 1,
      erros: [mensagem],
    };
  } finally {
    clearTimeout(temporizador);
  }
}

async function processarFonte(
  fonte: FonteAtiva
): Promise<ResultadoFonte> {
  if (!ehFonteMercadoLivre(fonte)) {
    return consultarFonteGenerica(
      fonte
    );
  }

  const resultadoBase =
    criarResultadoBase(fonte);

  if (!fonte.url) {
    return {
      ...resultadoBase,
      modo: "extracao",
      consultada: false,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem:
        "A fonte do Mercado Livre não possui URL.",
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 1,
      erros: [
        "A fonte do Mercado Livre não possui URL.",
      ],
    };
  }

  const fonteMercadoLivre: FonteMercadoLivre =
    {
      id: fonte.id,
      loja_id: fonte.loja_id,
      nome: fonte.nome,
      url: fonte.url,
      ativa: fonte.ativa,
      prioridade: fonte.prioridade,
      intervalo_minutos:
        fonte.intervalo_minutos,
    };

  try {
    const resultado =
      await processarFonteMercadoLivre(
        fonteMercadoLivre
      );

    return {
      ...resultadoBase,
      modo: "extracao",
      consultada: true,
      sucesso:
        resultado.total_erros === 0,
      status_http: 200,
      content_type: "text/html",
      duracao_ms:
        resultado.duracao_ms,
      mensagem:
        resultado.total_erros > 0
          ? `Mercado Livre processado com ${resultado.total_erros} erro(s).`
          : "Ofertas do Mercado Livre processadas com sucesso.",
      ofertas_encontradas:
        resultado.ofertas_encontradas,
      ofertas_novas:
        resultado.ofertas_novas,
      ofertas_atualizadas:
        resultado.ofertas_atualizadas,
      ofertas_sem_alteracao:
        resultado.ofertas_sem_alteracao,
      total_erros:
        resultado.total_erros,
      erros: resultado.erros,
    };
  } catch (error) {
    const mensagem =
      mensagemErroProcessamentoMercadoLivre(
        error
      );

    return {
      ...resultadoBase,
      modo: "extracao",
      consultada: true,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem,
      ofertas_encontradas: 0,
      ofertas_novas: 0,
      ofertas_atualizadas: 0,
      ofertas_sem_alteracao: 0,
      total_erros: 1,
      erros: [mensagem],
    };
  }
}

export async function POST(
  request: NextRequest
) {
  let execucaoId: string | null =
    null;

  let tipoExecucao =
    "coleta_ofertas_manual";

  let origemExecucao =
    "painel_administrativo";

  let usuarioId: string | null =
    null;

  try {
    const segredoCron =
      process.env.CRON_SECRET?.trim() ??
      "";

    const autorizacao =
      request.headers.get(
        "authorization"
      ) ?? "";

    const prefixoBearer = "Bearer ";

    const tokenCron =
      autorizacao.startsWith(
        prefixoBearer
      )
        ? autorizacao
            .slice(
              prefixoBearer.length
            )
            .trim()
        : "";

    const tentouExecutarComoCron =
      tokenCron.length > 0;

    const execucaoAutomatica =
      segredoCron.length > 0 &&
      tokenCron === segredoCron;

    if (
      tentouExecutarComoCron &&
      !execucaoAutomatica
    ) {
      return NextResponse.json(
        {
          error:
            "Chave do agendamento inválida.",
        },
        {
          status: 401,
        }
      );
    }

    if (execucaoAutomatica) {
      tipoExecucao =
        "coleta_ofertas_automatica";

      origemExecucao =
        "railway_cron";
    } else {
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

      usuarioId = user.id;
    }

    const {
      data: execucaoCriada,
      error: erroCriacao,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .insert({
        loja_id: null,
        status: "executando",

        detalhes: {
          tipo:
            tipoExecucao,

          origem:
            origemExecucao,

          etapa:
            "inicializacao",

          usuario_id: usuarioId,
        },
      })
      .select(`
        id,
        loja_id,
        status,
        ofertas_encontradas,
        ofertas_novas,
        ofertas_atualizadas,
        ofertas_desativadas,
        total_erros,
        iniciado_em,
        finalizado_em,
        mensagem_erro,
        detalhes,
        created_at
      `)
      .single();

    if (
      erroCriacao ||
      !execucaoCriada
    ) {
      console.error(
        "Erro ao criar execução do Agente de Economia:",
        erroCriacao
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível iniciar a execução do agente.",
        },
        {
          status: 500,
        }
      );
    }

    execucaoId =
      execucaoCriada.id;

    const {
      data: fontesEncontradas,
      error: erroFontes,
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
        configuracao,

        loja:economize_lojas (
          id,
          nome,
          slug,
          ordem,
          ativa
        )
      `)
      .eq("ativa", true)
      .order("prioridade", {
        ascending: true,
      })
      .order("nome", {
        ascending: true,
      });

    if (erroFontes) {
      throw new Error(
        `Não foi possível consultar as fontes ativas: ${erroFontes.message}`
      );
    }

    const fontes =
      (fontesEncontradas ??
        []) as FonteAtiva[];

    const resultados: ResultadoFonte[] =
      [];

    for (const fonte of fontes) {
      let resultado: ResultadoFonte;

      try {
        resultado =
          await processarFonte(fonte);
      } catch (error) {
        const mensagem =
          obterMensagemErro(error);

        resultado = {
          ...criarResultadoBase(
            fonte
          ),

          modo: "consulta",
          consultada: false,
          sucesso: false,
          status_http: null,
          content_type: null,
          duracao_ms: 0,
          mensagem,
          ofertas_encontradas: 0,
          ofertas_novas: 0,
          ofertas_atualizadas: 0,
          ofertas_sem_alteracao: 0,
          total_erros: 1,
          erros: [mensagem],
        };
      }

      const ultimaExecucaoEm =
        new Date().toISOString();

      const proximaExecucaoEm =
        calcularProximaExecucao(
          fonte.intervalo_minutos
        );

      const {
        error:
          erroAtualizacaoFonte,
      } = await supabaseAdmin
        .from("economize_fontes")
        .update({
          ultima_execucao_em:
            ultimaExecucaoEm,

          proxima_execucao_em:
            proximaExecucaoEm,

          updated_at:
            ultimaExecucaoEm,
        })
        .eq("id", fonte.id);

      if (erroAtualizacaoFonte) {
        const mensagemAtualizacao =
          `Não foi possível atualizar as datas da fonte: ${erroAtualizacaoFonte.message}`;

        resultado.sucesso = false;

        resultado.total_erros += 1;

        resultado.erros.push(
          mensagemAtualizacao
        );

        resultado.mensagem =
          `${resultado.mensagem} ${mensagemAtualizacao}`;
      }

      resultados.push(resultado);
    }

    const ofertasEncontradas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.ofertas_encontradas,
        0
      );

    const ofertasNovas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.ofertas_novas,
        0
      );

    const ofertasAtualizadas =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.ofertas_atualizadas,
        0
      );

    const ofertasSemAlteracao =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.ofertas_sem_alteracao,
        0
      );

    const totalErros =
      resultados.reduce(
        (total, resultado) =>
          total +
          resultado.total_erros,
        0
      );

    const fontesConsultadas =
      resultados.filter(
        (resultado) =>
          resultado.consultada
      ).length;

    const fontesComSucesso =
      resultados.filter(
        (resultado) =>
          resultado.sucesso
      ).length;

    const fontesComErro =
      resultados.filter(
        (resultado) =>
          !resultado.sucesso
      ).length;

    const lojasMap = new Map<
      string,
      {
        id: string;
        nome: string;
        slug: string | null;
      }
    >();

    for (const fonte of fontes) {
      const loja =
        normalizarLoja(
          fonte.loja
        );

      lojasMap.set(
        fonte.loja_id,
        {
          id: fonte.loja_id,

          nome:
            loja?.nome ??
            "Loja não identificada",

          slug:
            loja?.slug ?? null,
        }
      );
    }

    const lojasMonitoradas =
      Array.from(
        lojasMap.values()
      );

    const inicioRegistrado =
      new Date(
        execucaoCriada.iniciado_em
      ).getTime();

    const finalizadoEm =
      new Date(
        Number.isNaN(
          inicioRegistrado
        )
          ? Date.now()
          : Math.max(
              Date.now(),
              inicioRegistrado + 1
            )
      ).toISOString();

    const statusExecucao =
      totalErros > 0
        ? "parcial"
        : "concluida";

    const {
      data: execucaoFinalizada,
      error: erroFinalizacao,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .update({
        status: statusExecucao,

        ofertas_encontradas:
          ofertasEncontradas,

        ofertas_novas:
          ofertasNovas,

        ofertas_atualizadas:
          ofertasAtualizadas,

        ofertas_desativadas: 0,

        total_erros:
          totalErros,

        finalizado_em:
          finalizadoEm,

        mensagem_erro:
          totalErros > 0
            ? `${totalErros} erro(s) foram encontrados durante a execução.`
            : null,

        detalhes: {
          tipo:
            tipoExecucao,

          origem:
            origemExecucao,

          etapa:
            "ofertas_processadas",

          usuario_id:
            usuarioId,

          lojas_ativas:
            lojasMonitoradas.length,

          lojas:
            lojasMonitoradas,

          fontes_ativas:
            fontes.length,

          fontes_consultadas:
            fontesConsultadas,

          fontes_sucesso:
            fontesComSucesso,

          fontes_erro:
            fontesComErro,

          ofertas_sem_alteracao:
            ofertasSemAlteracao,

          resultados,

          mensagem:
            fontes.length === 0
              ? "Nenhuma fonte ativa foi encontrada."
              : totalErros > 0
                ? "As fontes foram processadas com alguns erros."
                : "As ofertas das fontes ativas foram processadas com sucesso.",
        },
      })
      .eq("id", execucaoId)
      .select(`
        id,
        loja_id,
        status,
        ofertas_encontradas,
        ofertas_novas,
        ofertas_atualizadas,
        ofertas_desativadas,
        total_erros,
        iniciado_em,
        finalizado_em,
        mensagem_erro,
        detalhes,
        created_at
      `)
      .single();

    if (
      erroFinalizacao ||
      !execucaoFinalizada
    ) {
      throw new Error(
        erroFinalizacao?.message ||
          "Não foi possível finalizar o histórico da execução."
      );
    }

    return NextResponse.json({
      mensagem:
        fontes.length === 0
          ? "Execução concluída, mas nenhuma fonte ativa foi encontrada."
          : totalErros > 0
            ? `Execução concluída com ${totalErros} erro(s).`
            : "Ofertas processadas com sucesso.",

      execucao:
        execucaoFinalizada,
    });
  } catch (error) {
    const mensagemErro =
      obterMensagemErro(error);

    console.error(
      "Erro no Agente de Economia:",
      error
    );

    if (execucaoId) {
      const {
        error: erroRegistro,
      } = await supabaseAdmin
        .from(
          "economize_execucoes"
        )
        .update({
          status: "erro",

          total_erros: 1,

          finalizado_em:
            new Date().toISOString(),

          mensagem_erro:
            mensagemErro,

          detalhes: {
            tipo:
              tipoExecucao,

            origem:
              origemExecucao,

            etapa: "erro",

            mensagem:
              mensagemErro,
          },
        })
        .eq("id", execucaoId);

      if (erroRegistro) {
        console.error(
          "Erro ao registrar falha da execução:",
          erroRegistro
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "A execução do agente não foi concluída.",

        detalhes:
          mensagemErro,
      },
      {
        status: 500,
      }
    );
  }
}
export async function GET(
  request: NextRequest
) {
  return POST(request);
}