import { Sandbox } from "@vercel/sandbox";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_BUYER_PATH = "/vercel/tmp/meli-buyer-auth.json";
const AUTH_AFILIADO_PATH = "/vercel/tmp/meli-auth.json";
const SCRIPT_PATH = "/vercel/scripts/verificar-comissoes-ml-v2.cjs";
const RESULT_PATH = "/vercel/tmp/ml-v2-comissoes.json";
const PROGRESS_PATH = "/vercel/tmp/ml-v2-comissoes-progresso.json";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const MAX_CANDIDATOS = 100;
const TAMANHO_LOTE_PADRAO = 6;
const TAMANHO_LOTE_MAXIMO = 8;

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

type ResultadoComissao = {
  item_id?: string;
  percentual?: number | null;
  status?: string;
  erro?: string;
  url_final?: string;
  verificada_em?: string;
};

type CandidatoBanco = {
  id: string;
  status: string | null;
  dados_brutos: Record<string, unknown> | null;
  ultima_coleta_em: string | null;
};

type EntradaItem = {
  itemId: string;
  candidatos: CandidatoBanco[];
};

type ResultadoLote = {
  resultados: ResultadoComissao[];
  authUtilizada: "buyer" | "afiliado_fallback";
};

async function rodarComando(
  sandbox: SandboxInstancia,
  opcoes: {
    cmd: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
) {
  const resultado = await sandbox.runCommand(opcoes);
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();

  return { resultado, stdout, stderr };
}

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() ?? "";
  if (!segredo) return false;

  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(request: NextRequest) {
  if (autorizadoComoCron(request)) return true;
  return usuarioAutenticado();
}

function primeiroItemId(dadosBrutos: unknown) {
  const bruto = (dadosBrutos || {}) as Record<string, unknown>;
  const itemIds = Array.isArray(bruto.item_ids) ? bruto.item_ids : [];

  const primeiro = String(itemIds[0] || "").trim().toUpperCase();
  return /^MLB\d+$/.test(primeiro) ? primeiro : null;
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro || "Erro inesperado.");
}

function pareceErroSessao(resultado: ResultadoComissao) {
  const texto = String(resultado.erro || "").toLowerCase();
  return (
    texto.includes("sessao afiliada") ||
    texto.includes("sessão afiliada") ||
    texto.includes("login") ||
    texto.includes("account-verification") ||
    texto.includes("captcha")
  );
}

async function arquivoExiste(sandbox: SandboxInstancia, caminho: string) {
  const teste = await rodarComando(sandbox, {
    cmd: "test",
    args: ["-s", caminho],
  });

  return teste.resultado.exitCode === 0;
}

async function executarScript(
  sandbox: SandboxInstancia,
  authPath: string,
  itemIds: string[],
  execucaoId: string
) {
  await rodarComando(sandbox, {
    cmd: "rm",
    args: ["-f", RESULT_PATH, PROGRESS_PATH],
  });

  const execucao = await rodarComando(sandbox, {
    cmd: "xvfb-run",
    args: ["-a", "node", SCRIPT_PATH],
    cwd: "/vercel",
    env: {
      MELI_AFFILIATE_AUTH_STATE_PATH: authPath,
      ML_V2_COMISSOES_RESULT_PATH: RESULT_PATH,
      ML_V2_COMISSOES_PROGRESS_PATH: PROGRESS_PATH,
      ML_V2_COMISSOES_EXECUTION_ID: execucaoId,
      ML_V2_COMISSOES_CONCURRENCY: "3",
      ML_V2_ITEM_IDS: JSON.stringify(itemIds),
    },
  });

  if (execucao.resultado.exitCode !== 0) {
    throw new Error(
      execucao.stderr || execucao.stdout || "Falha verificando comissoes ML V2."
    );
  }

  const arquivo = await rodarComando(sandbox, {
    cmd: "cat",
    args: [RESULT_PATH],
  });

  if (arquivo.resultado.exitCode !== 0 || !arquivo.stdout) {
    throw new Error("O verificador terminou sem gerar o resultado de comissoes.");
  }

  const resultado = JSON.parse(arquivo.stdout) as {
    resultados?: ResultadoComissao[];
  };

  return Array.isArray(resultado.resultados) ? resultado.resultados : [];
}

async function executarLoteIsolado(
  itemIds: string[],
  execucaoId: string
): Promise<ResultadoLote> {
  let sandbox: SandboxInstancia | null = null;

  try {
    sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const preparar = await rodarComando(sandbox, {
      cmd: "mkdir",
      args: ["-p", "/vercel/scripts", "/vercel/tmp"],
    });

    if (preparar.resultado.exitCode !== 0) {
      throw new Error(
        preparar.stderr || "Falha preparando diretorios do Sandbox."
      );
    }

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const scriptUrl = `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(
      commit
    )}/scripts/verificar-comissoes-ml-v2.cjs`;

    const download = await rodarComando(sandbox, {
      cmd: "curl",
      args: [
        "-fsSL",
        "--max-time",
        "30",
        scriptUrl,
        "-o",
        SCRIPT_PATH,
      ],
    });

    if (download.resultado.exitCode !== 0) {
      throw new Error(
        download.stderr || "Falha sincronizando o verificador de comissoes ML V2."
      );
    }

    const buyerExiste = await arquivoExiste(sandbox, AUTH_BUYER_PATH);
    const afiliadoExiste = await arquivoExiste(sandbox, AUTH_AFILIADO_PATH);

    if (!buyerExiste && !afiliadoExiste) {
      throw new Error(
        "Nenhuma sessao do Mercado Livre esta disponivel no Sandbox. Renove a sessao antes de verificar comissoes."
      );
    }

    let authUtilizada: "buyer" | "afiliado_fallback" = buyerExiste
      ? "buyer"
      : "afiliado_fallback";
    let resultados = await executarScript(
      sandbox,
      buyerExiste ? AUTH_BUYER_PATH : AUTH_AFILIADO_PATH,
      itemIds,
      execucaoId
    );

    const todosErrosSessao =
      resultados.length > 0 &&
      resultados.every(
        (resultado) => resultado.status === "erro" && pareceErroSessao(resultado)
      );

    if (todosErrosSessao && buyerExiste && afiliadoExiste) {
      authUtilizada = "afiliado_fallback";
      resultados = await executarScript(
        sandbox,
        AUTH_AFILIADO_PATH,
        itemIds,
        `${execucaoId}-fallback`
      );
    }

    return { resultados, authUtilizada };
  } finally {
    if (sandbox) {
      await sandbox.stop().catch((erro) => {
        console.error(
          "[ML V2 comissoes] Falha ao parar Sandbox do lote:",
          mensagemErro(erro)
        );
      });
    }
  }
}

async function atualizarCandidatos(
  entradas: EntradaItem[],
  resultados: ResultadoComissao[]
) {
  const porItem = new Map(
    resultados
      .filter((item) => item.item_id)
      .map((item) => [String(item.item_id), item])
  );

  let atualizados = 0;

  for (const entrada of entradas) {
    const comissao = porItem.get(entrada.itemId);
    if (!comissao) continue;

    for (const candidato of entrada.candidatos) {
      const bruto = {
        ...((candidato.dados_brutos || {}) as Record<string, unknown>),
        comissao_afiliado: {
          item_id: entrada.itemId,
          percentual:
            typeof comissao.percentual === "number" ? comissao.percentual : null,
          status: comissao.status || "nao_identificada",
          erro: comissao.erro || null,
          url_final: comissao.url_final || null,
          verificada_em: comissao.verificada_em || new Date().toISOString(),
          fonte: "toolbar_afiliados_mercado_livre",
          observacao: "estimativa baseada no primeiro item participante",
        },
      };

      const { error: erroUpdate } = await supabaseAdmin
        .from("economize_cupons_candidatos")
        .update({
          dados_brutos: bruto,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidato.id);

      if (erroUpdate) {
        console.error(
          `[ML V2 comissoes] Falha atualizando ${candidato.id}:`,
          erroUpdate.message
        );
        continue;
      }

      atualizados += 1;
    }
  }

  return atualizados;
}

export async function POST(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        offset?: number;
        tamanho_lote?: number;
        execucao_id?: string;
      }
    | null;

  const modoLote = Boolean(body);
  const offsetInicial = Math.max(0, Number(body?.offset || 0) || 0);
  const tamanhoLote = Math.max(
    1,
    Math.min(
      TAMANHO_LOTE_MAXIMO,
      Number(body?.tamanho_lote || TAMANHO_LOTE_PADRAO) || TAMANHO_LOTE_PADRAO
    )
  );
  const execucaoId = String(body?.execucao_id || "").trim() || crypto.randomUUID();

  try {
    const { data: candidatos, error: erroCandidatos } = await supabaseAdmin
      .from("economize_cupons_candidatos")
      .select("id,status,dados_brutos,ultima_coleta_em")
      .eq("origem", "mercado_livre_v2")
      .neq("status", "descartado")
      .order("ultima_coleta_em", { ascending: false })
      .limit(MAX_CANDIDATOS);

    if (erroCandidatos) {
      throw new Error(`Falha lendo candidatos: ${erroCandidatos.message}`);
    }

    const entradasPorItem = new Map<string, EntradaItem>();

    for (const candidato of (candidatos || []) as CandidatoBanco[]) {
      const itemId = primeiroItemId(candidato.dados_brutos);
      if (!itemId) continue;

      const existente = entradasPorItem.get(itemId);
      if (existente) {
        existente.candidatos.push(candidato);
      } else {
        entradasPorItem.set(itemId, {
          itemId,
          candidatos: [candidato],
        });
      }
    }

    const entradas = [...entradasPorItem.values()];
    const totalDisponivel = entradas.length;

    if (offsetInicial >= totalDisponivel) {
      return NextResponse.json({
        sucesso: true,
        execucao_id: execucaoId,
        total_disponivel: totalDisponivel,
        total_consultados: 0,
        candidatos_atualizados: 0,
        com_comissao: 0,
        comissao_zero: 0,
        nao_identificados: 0,
        erros: 0,
        erros_detalhados: [],
        proximo_offset: totalDisponivel,
        concluido: true,
      });
    }

    let offset = offsetInicial;
    let totalConsultados = 0;
    let totalAtualizados = 0;
    let totalComComissao = 0;
    let totalComissaoZero = 0;
    let totalNaoIdentificados = 0;
    let totalErros = 0;
    const errosDetalhados: string[] = [];
    let ultimoItem: string | null = null;
    let authUtilizada: "buyer" | "afiliado_fallback" | null = null;

    do {
      const lote = entradas.slice(offset, offset + tamanhoLote);
      if (lote.length === 0) break;

      const itemIds = lote.map((entrada) => entrada.itemId);
      ultimoItem = itemIds[itemIds.length - 1] || ultimoItem;

      let resultadoLote: ResultadoLote;

      try {
        resultadoLote = await executarLoteIsolado(
          itemIds,
          `${execucaoId}-${offset}`
        );
      } catch (erro) {
        const mensagem = mensagemErro(erro);
        const status = mensagem.includes("Sandbox stream was closed") ? 503 : 500;

        return NextResponse.json(
          {
            sucesso: false,
            execucao_id: execucaoId,
            erro: mensagem,
            erro_stream: mensagem.includes("Sandbox stream was closed"),
            total_disponivel: totalDisponivel,
            total_consultados: totalConsultados,
            candidatos_atualizados: totalAtualizados,
            com_comissao: totalComComissao,
            comissao_zero: totalComissaoZero,
            nao_identificados: totalNaoIdentificados,
            erros: totalErros,
            ultimo_item: ultimoItem,
            proximo_offset: offset,
            concluido: false,
          },
          { status }
        );
      }

      authUtilizada = resultadoLote.authUtilizada;
      const resultados = resultadoLote.resultados;

      const todosErrosSessao =
        resultados.length > 0 &&
        resultados.every(
          (resultado) => resultado.status === "erro" && pareceErroSessao(resultado)
        );

      if (todosErrosSessao) {
        const detalhe = resultados.find((item) => item.erro)?.erro;
        return NextResponse.json(
          {
            sucesso: false,
            execucao_id: execucaoId,
            sessao_expirada: true,
            erro:
              detalhe ||
              "A sessao do Mercado Livre no Sandbox expirou. Renove a sessao e tente novamente.",
            total_disponivel: totalDisponivel,
            total_consultados: totalConsultados,
            candidatos_atualizados: totalAtualizados,
            com_comissao: totalComComissao,
            comissao_zero: totalComissaoZero,
            nao_identificados: totalNaoIdentificados,
            erros: totalErros,
            ultimo_item: ultimoItem,
            proximo_offset: offset,
            concluido: false,
          },
          { status: 409 }
        );
      }

      totalAtualizados += await atualizarCandidatos(lote, resultados);
      totalConsultados += resultados.length;
      totalComissaoZero += resultados.filter(
        (item) => item.percentual === 0
      ).length;
      totalComComissao += resultados.filter(
        (item) => typeof item.percentual === "number" && item.percentual > 0
      ).length;
      totalErros += resultados.filter((item) => item.status === "erro").length;
      totalNaoIdentificados += resultados.filter(
        (item) => item.status === "nao_identificada"
      ).length;

      for (const item of resultados) {
        if (item.status === "erro" && item.erro && errosDetalhados.length < 5) {
          errosDetalhados.push(`${item.item_id || "item"}: ${item.erro}`);
        }
      }

      offset = Math.min(offset + lote.length, totalDisponivel);

      if (modoLote) break;
    } while (offset < totalDisponivel);

    return NextResponse.json({
      sucesso: true,
      execucao_id: execucaoId,
      auth_utilizada: authUtilizada,
      total_disponivel: totalDisponivel,
      total_consultados: totalConsultados,
      candidatos_atualizados: totalAtualizados,
      com_comissao: totalComComissao,
      comissao_zero: totalComissaoZero,
      nao_identificados: totalNaoIdentificados,
      erros: totalErros,
      erros_detalhados: errosDetalhados,
      ultimo_item: ultimoItem,
      proximo_offset: offset,
      concluido: offset >= totalDisponivel,
      executado_em: new Date().toISOString(),
    });
  } catch (erro) {
    const mensagem = mensagemErro(erro);
    console.error("[ML V2 comissoes] Erro:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        execucao_id: execucaoId,
        erro: mensagem,
        erro_stream: mensagem.includes("Sandbox stream was closed"),
        proximo_offset: offsetInicial,
      },
      { status: mensagem.includes("Sandbox stream was closed") ? 503 : 500 }
    );
  }
}
