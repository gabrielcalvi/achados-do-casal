import { Sandbox } from "@vercel/sandbox";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistirCandidatosMlV2 } from "@/lib/services/mlV2Candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = "achados-cupons-ml-test";
const AUTH_STATE_PATH = "/vercel/tmp/meli-buyer-auth.json";
const AUTH_STATE_FALLBACK_PATH = "/vercel/tmp/meli-auth.json";
const COLLECTOR_PATH = "/vercel/scripts/coletar-cupons-oficiais-ml-v2-lote.cjs";
const RESULT_PATH = "/vercel/tmp/ml-cupons-v2-oficiais.json";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const MAX_PAGINAS_LOTE = 20;

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;
type ExecucaoComando = Awaited<ReturnType<typeof rodarComando>>;

type EstadoCandidato = {
  id: string;
  campanha_externa_id: string | null;
  status: string | null;
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

function resumoCupom(
  cupom: Record<string, any>,
  estado?: EstadoCandidato
) {
  return {
    candidato_id: estado?.id ?? null,
    status: estado?.status ?? "coletado",
    campanha_id: cupom.campanha_id ?? null,
    titulo: cupom.titulo ?? null,
    valor_desconto: cupom.valor_desconto ?? null,
    compra_minima: cupom.compra_minima ?? null,
    validade: cupom.validade ?? null,
    escopo: cupom.escopo ?? null,
    criado_por: cupom.criado_por ?? null,
    acao: cupom.acao ?? null,
    tipo_acao: cupom.tipo_acao ?? null,
    possui_token_ativacao: Boolean(cupom.possui_token_ativacao),
    quantidade_produtos: Array.isArray(cupom.produtos)
      ? cupom.produtos.length
      : 0,
  };
}

function erroSessaoInvalida(execucao: ExecucaoComando) {
  return `${execucao.stderr}\n${execucao.stdout}`.includes(
    "Sessao comprador invalida"
  );
}

async function arquivoExiste(sandbox: SandboxInstancia, caminho: string) {
  const teste = await rodarComando(sandbox, {
    cmd: "test",
    args: ["-s", caminho],
  });

  return teste.resultado.exitCode === 0;
}

async function executarColetor(
  sandbox: SandboxInstancia,
  authStatePath: string
) {
  return rodarComando(sandbox, {
    cmd: "xvfb-run",
    args: ["-a", "node", COLLECTOR_PATH],
    cwd: "/vercel",
    env: {
      MELI_BUYER_AUTH_STATE_PATH: authStatePath,
      ML_V2_MAX_PAGES: String(MAX_PAGINAS_LOTE),
    },
  });
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  let sandbox: SandboxInstancia | null = null;

  try {
    sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const diretorios = await rodarComando(sandbox, {
      cmd: "mkdir",
      args: ["-p", "/vercel/scripts", "/vercel/tmp"],
    });

    if (diretorios.resultado.exitCode !== 0) {
      throw new Error(
        diretorios.stderr || "Falha preparando diretorios do Sandbox."
      );
    }

    const buyerExiste = await arquivoExiste(sandbox, AUTH_STATE_PATH);
    const afiliadoExiste = await arquivoExiste(
      sandbox,
      AUTH_STATE_FALLBACK_PATH
    );

    if (!buyerExiste && !afiliadoExiste) {
      throw new Error(
        "Nenhuma sessao do Mercado Livre foi encontrada no Sandbox."
      );
    }

    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const collectorUrl = `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(
      commit
    )}/scripts/coletar-cupons-oficiais-ml-v2-lote.cjs`;

    const download = await rodarComando(sandbox, {
      cmd: "curl",
      args: [
        "-fsSL",
        "--max-time",
        "30",
        collectorUrl,
        "-o",
        COLLECTOR_PATH,
      ],
    });

    if (download.resultado.exitCode !== 0) {
      throw new Error(
        download.stderr ||
          "Falha sincronizando o coletor ML V2 em lote com o Sandbox."
      );
    }

    let execucao: ExecucaoComando | null = null;
    let sessaoUtilizada: "buyer" | "afiliado_fallback" | null = null;

    if (buyerExiste) {
      execucao = await executarColetor(sandbox, AUTH_STATE_PATH);
      if (execucao.resultado.exitCode === 0) sessaoUtilizada = "buyer";
    }

    if (
      (!execucao || execucao.resultado.exitCode !== 0) &&
      afiliadoExiste &&
      (!execucao || erroSessaoInvalida(execucao))
    ) {
      console.warn(
        "[ML V2] Sessao buyer invalida; tentando sessao afiliada existente como fallback."
      );

      execucao = await executarColetor(sandbox, AUTH_STATE_FALLBACK_PATH);

      if (execucao.resultado.exitCode === 0) {
        sessaoUtilizada = "afiliado_fallback";
      }
    }

    if (!execucao || execucao.resultado.exitCode !== 0) {
      if (execucao && erroSessaoInvalida(execucao)) {
        throw new Error(
          "As sessoes do Mercado Livre no Sandbox expiraram. E necessario renovar o login para continuar o ML V2."
        );
      }

      throw new Error(
        execucao?.stderr ||
          execucao?.stdout ||
          "Falha executando o coletor ML V2 em lote."
      );
    }

    const arquivo = await rodarComando(sandbox, {
      cmd: "cat",
      args: [RESULT_PATH],
    });

    if (arquivo.resultado.exitCode !== 0 || !arquivo.stdout) {
      throw new Error("O coletor terminou sem gerar o resultado ML V2.");
    }

    let resultado: Record<string, any>;

    try {
      resultado = JSON.parse(arquivo.stdout) as Record<string, any>;
    } catch {
      throw new Error("O resultado ML V2 possui JSON invalido.");
    }

    const cupons = Array.isArray(resultado.cupons) ? resultado.cupons : [];
    const estados = await persistirCandidatosMlV2(cupons);

    return NextResponse.json({
      sucesso: true,
      versao: "ml-v2-lote",
      modo_execucao: "lote_seguro",
      sessao_utilizada: sessaoUtilizada,
      fonte: "central_comprador_mercado_livre",
      regra:
        "somente cupons created_by=meli, FIXED, validos e com regra simples; podem ser site inteiro ou produtos selecionados",
      afiliado_obrigatorio_antes_publicacao: true,
      publicacao_automatica: false,
      persistencia_supabase: true,
      commit_coletor: commit,
      max_paginas_lote: MAX_PAGINAS_LOTE,
      pagina_inicial: Number(resultado.pagina_inicial || 0),
      pagina_final: Number(resultado.pagina_final || 0),
      total_paginas_disponiveis: Number(
        resultado.total_paginas_disponiveis || 0
      ),
      varredura_completa: Boolean(resultado.varredura_completa),
      total_paginas_lidas: Number(resultado.total_paginas_lidas || 0),
      total_encontrados: Number(resultado.total_encontrados || 0),
      valores_encontrados: Array.isArray(resultado.valores_encontrados)
        ? resultado.valores_encontrados
        : [],
      por_valor: resultado.por_valor || {},
      por_escopo: resultado.por_escopo || {},
      amostra: cupons.slice(0, 12).map((cupom: Record<string, any>) => {
        const campanhaId = String(cupom.campanha_id || "");
        return resumoCupom(cupom, estados.get(campanhaId));
      }),
      executado_em: new Date().toISOString(),
    });
  } catch (erro) {
    console.error("[ML V2] Erro na coleta segura em lote:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        publicacao_automatica: false,
        erro:
          erro instanceof Error ? erro.message : "Erro inesperado no ML V2.",
      },
      { status: 500 }
    );
  } finally {
    if (sandbox) {
      await sandbox.stop().catch((erro) => {
        console.error("[ML V2] Falha ao parar Sandbox:", erro);
      });
    }
  }
}
