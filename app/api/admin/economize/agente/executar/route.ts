import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

type ResultadoConsultaFonte = {
  fonte_id: string;
  fonte_nome: string;
  loja_id: string;
  loja_nome: string;
  tipo: string;
  url: string | null;
  consultada: boolean;
  sucesso: boolean;
  status_http: number | null;
  content_type: string | null;
  duracao_ms: number;
  mensagem: string;
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

async function consultarFonte(
  fonte: FonteAtiva
): Promise<ResultadoConsultaFonte> {
  const loja = normalizarLoja(fonte.loja);

  const resultadoBase = {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    loja_id: fonte.loja_id,
    loja_nome:
      loja?.nome ?? "Loja não identificada",
    tipo: fonte.tipo,
    url: fonte.url,
  };

  if (fonte.tipo === "manual") {
    return {
      ...resultadoBase,
      consultada: false,
      sucesso: true,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem:
        "Fonte manual registrada sem consulta automática.",
    };
  }

  if (!fonte.url) {
    return {
      ...resultadoBase,
      consultada: false,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: 0,
      mensagem:
        "A fonte não possui uma URL cadastrada.",
    };
  }

  const inicio = Date.now();
  const controlador = new AbortController();

  const temporizador = setTimeout(() => {
    controlador.abort();
  }, 20000);

  try {
    const resposta = await fetch(fonte.url, {
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
          "AchadosDoCasal-EconomizeBot/1.0",
      },
    });

    const contentType =
      resposta.headers.get("content-type");

    const duracaoMs = Math.max(
      Date.now() - inicio,
      1
    );

    if (resposta.body) {
      await resposta.body.cancel();
    }

    if (!resposta.ok) {
      return {
        ...resultadoBase,
        consultada: true,
        sucesso: false,
        status_http: resposta.status,
        content_type: contentType,
        duracao_ms: duracaoMs,
        mensagem: `A fonte respondeu com HTTP ${resposta.status}.`,
      };
    }

    return {
      ...resultadoBase,
      consultada: true,
      sucesso: true,
      status_http: resposta.status,
      content_type: contentType,
      duracao_ms: duracaoMs,
      mensagem:
        "Fonte acessada com sucesso.",
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
      consultada: true,
      sucesso: false,
      status_http: null,
      content_type: null,
      duracao_ms: duracaoMs,
      mensagem,
    };
  } finally {
    clearTimeout(temporizador);
  }
}

export async function POST() {
  let execucaoId: string | null = null;

  try {
    const supabase = await createClient();

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

    const {
      data: execucaoCriada,
      error: erroCriacao,
    } = await supabaseAdmin
      .from("economize_execucoes")
      .insert({
        loja_id: null,
        status: "executando",
        detalhes: {
          tipo: "coleta_fontes_manual",
          origem: "painel_administrativo",
          etapa: "inicializacao",
          usuario_id: user.id,
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

    if (erroCriacao || !execucaoCriada) {
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

    execucaoId = execucaoCriada.id;

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
      (fontesEncontradas ?? []) as FonteAtiva[];

    const resultados: ResultadoConsultaFonte[] =
      [];

    for (const fonte of fontes) {
      const resultado =
        await consultarFonte(fonte);

      const ultimaExecucaoEm =
        new Date().toISOString();

      const proximaExecucaoEm =
        calcularProximaExecucao(
          fonte.intervalo_minutos
        );

      const {
        error: erroAtualizacaoFonte,
      } = await supabaseAdmin
        .from("economize_fontes")
        .update({
          ultima_execucao_em:
            ultimaExecucaoEm,
          proxima_execucao_em:
            proximaExecucaoEm,
          updated_at: ultimaExecucaoEm,
        })
        .eq("id", fonte.id);

      if (erroAtualizacaoFonte) {
        resultado.sucesso = false;
        resultado.mensagem = `${resultado.mensagem} Não foi possível atualizar o histórico da fonte: ${erroAtualizacaoFonte.message}`;
      }

      resultados.push(resultado);
    }

    const fontesConsultadas =
      resultados.filter(
        (resultado) =>
          resultado.consultada
      ).length;

    const fontesComSucesso =
      resultados.filter(
        (resultado) => resultado.sucesso
      ).length;

    const totalErros =
      resultados.filter(
        (resultado) => !resultado.sucesso
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
        normalizarLoja(fonte.loja);

      lojasMap.set(fonte.loja_id, {
        id: fonte.loja_id,
        nome:
          loja?.nome ??
          "Loja não identificada",
        slug: loja?.slug ?? null,
      });
    }

    const lojasMonitoradas = Array.from(
      lojasMap.values()
    );

    const inicioRegistrado = new Date(
      execucaoCriada.iniciado_em
    ).getTime();

    const finalizadoEm = new Date(
      Number.isNaN(inicioRegistrado)
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
        ofertas_encontradas: 0,
        ofertas_novas: 0,
        ofertas_atualizadas: 0,
        ofertas_desativadas: 0,
        total_erros: totalErros,
        finalizado_em: finalizadoEm,
        mensagem_erro:
          totalErros > 0
            ? `${totalErros} fonte(s) apresentaram erro.`
            : null,
        detalhes: {
          tipo: "coleta_fontes_manual",
          origem:
            "painel_administrativo",
          etapa: "fontes_consultadas",
          usuario_id: user.id,

          lojas_ativas:
            lojasMonitoradas.length,

          lojas: lojasMonitoradas,

          fontes_ativas: fontes.length,
          fontes_consultadas:
            fontesConsultadas,
          fontes_sucesso:
            fontesComSucesso,
          fontes_erro: totalErros,

          resultados,

          mensagem:
            fontes.length === 0
              ? "Nenhuma fonte ativa foi encontrada."
              : "As fontes ativas foram consultadas. A extração das oportunidades será realizada na próxima etapa.",
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
            ? `Execução concluída com ${totalErros} erro(s) nas fontes.`
            : "Fontes consultadas com sucesso.",
      execucao: execucaoFinalizada,
    });
  } catch (error) {
    const mensagemErro =
      obterMensagemErro(error);

    console.error(
      "Erro no Agente de Economia:",
      error
    );

    if (execucaoId) {
      const { error: erroRegistro } =
        await supabaseAdmin
          .from("economize_execucoes")
          .update({
            status: "erro",
            total_erros: 1,
            finalizado_em:
              new Date().toISOString(),
            mensagem_erro: mensagemErro,
            detalhes: {
              tipo: "coleta_fontes_manual",
              origem:
                "painel_administrativo",
              etapa: "erro",
              mensagem: mensagemErro,
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
        detalhes: mensagemErro,
      },
      {
        status: 500,
      }
    );
  }
}