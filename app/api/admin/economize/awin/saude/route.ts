import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";

type LojaConfig = {
  slug: string;
  nome: string;
  statusPath: string;
  executarPath: string;
};

const LOJAS: LojaConfig[] = [
  {
    slug: "cea",
    nome: "C&A",
    statusPath: "/vercel/tmp/awin-produtos-status.json",
    executarPath: "/api/admin/economize/awin/produtos/executar",
  },
  {
    slug: "nike",
    nome: "Nike",
    statusPath: "/vercel/tmp/awin-nike-produtos-status.json",
    executarPath: "/api/admin/economize/awin/nike/produtos/executar",
  },
  {
    slug: "kabum",
    nome: "KaBuM",
    statusPath: "/vercel/tmp/awin-kabum-produtos-status.json",
    executarPath: "/api/admin/economize/awin/kabum/produtos/executar",
  },
  {
    slug: "cobasi",
    nome: "Cobasi",
    statusPath: "/vercel/tmp/awin-produtos-cobasi-status.json",
    executarPath: "/api/admin/economize/awin/cobasi/produtos/executar",
  },
  {
    slug: "lauri-esporte",
    nome: "Lauri Esporte",
    statusPath: "/vercel/tmp/awin-lauri-produtos-status.json",
    executarPath: "/api/admin/economize/awin/lauri-esporte/produtos/executar",
  },
];

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function lerJsonSandbox(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, path: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [path], cwd: "/vercel" });
  if (resultado.exitCode !== 0) return null;
  const texto = (await resultado.stdout()).trim();
  if (!texto) return null;
  try {
    return JSON.parse(texto) as Record<string, any>;
  } catch {
    return null;
  }
}

function extrairLoja(status: Record<string, any> | null, slug: string) {
  if (!status) return null;
  const lojas = Array.isArray(status.lojas) ? status.lojas : [];
  return lojas.find((item: any) => String(item?.slug || "") === slug) || null;
}

function horasDesde(valor: string | null | undefined) {
  if (!valor) return null;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (Date.now() - ms) / 3_600_000);
}

export async function GET(_request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });

    const [watchdogResp, parceirosResp, statusFiles] = await Promise.all([
      supabaseAdmin
        .from("sistema_watchdog_status")
        .select("chave,status,mensagem,metricas,verificado_em,ultima_ok_em")
        .in("chave", LOJAS.map((loja) => `catalogo_${loja.slug}`)),
      supabaseAdmin
        .from("afiliados_parceiros")
        .select("slug,nome,status,rede,integracoes,automacao_status,pendencia,proximo_passo")
        .in("slug", LOJAS.map((loja) => loja.slug)),
      Promise.all(
        LOJAS.map(async (loja) => ({
          slug: loja.slug,
          status: await lerJsonSandbox(sandbox, loja.statusPath),
        }))
      ),
    ]);

    if (watchdogResp.error) throw watchdogResp.error;
    if (parceirosResp.error) throw parceirosResp.error;

    const watchdogMap = new Map(
      (watchdogResp.data || []).map((item: any) => [String(item.chave), item])
    );
    const parceirosMap = new Map(
      (parceirosResp.data || []).map((item: any) => [String(item.slug), item])
    );
    const statusMap = new Map(statusFiles.map((item) => [item.slug, item.status]));

    const lojas = [];

    for (const config of LOJAS) {
      const origem = `agente_produtos_awin_${config.slug}`;

      const [ativosResp, pendentesResp, totalResp, ultimoResp] = await Promise.all([
        supabaseAdmin
          .from("economize_ofertas")
          .select("id", { count: "exact", head: true })
          .eq("origem", origem)
          .eq("status", "ativo"),
        supabaseAdmin
          .from("economize_ofertas")
          .select("id", { count: "exact", head: true })
          .eq("origem", origem)
          .eq("status", "pendente"),
        supabaseAdmin
          .from("economize_ofertas")
          .select("id", { count: "exact", head: true })
          .eq("origem", origem),
        supabaseAdmin
          .from("economize_ofertas")
          .select("updated_at,verificado_em,coletado_em")
          .eq("origem", origem)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const statusCompleto = statusMap.get(config.slug) as Record<string, any> | null | undefined;
      const statusLoja = extrairLoja(statusCompleto || null, config.slug);
      const watchdog = watchdogMap.get(`catalogo_${config.slug}`) as any;
      const parceiro = parceirosMap.get(config.slug) as any;
      const ultimaExecucao =
        statusCompleto?.executado_em ||
        statusCompleto?.fim ||
        statusCompleto?.atualizadoEm ||
        ultimoResp.data?.verificado_em ||
        ultimoResp.data?.coletado_em ||
        ultimoResp.data?.updated_at ||
        null;

      const idade = horasDesde(ultimaExecucao);
      const estado =
        statusLoja?.erro
          ? "erro"
          : statusCompleto?.sucesso === false
            ? "erro"
            : idade === null
              ? (watchdog?.status || "atencao")
              : idade > 8
                ? "erro"
                : "ok";

      lojas.push({
        slug: config.slug,
        nome: config.nome,
        estado,
        mensagem:
          statusLoja?.erro
            ? String(statusLoja.erro)
            : estado === "ok"
              ? "Coletor executou dentro da janela e a vitrine está sendo alimentada."
              : (watchdog?.mensagem || "Sem execução recente confirmada."),
        executar_path: config.executarPath,
        ultima_execucao: ultimaExecucao,
        horas_desde_execucao: idade,
        feed: {
          disponivel: statusLoja?.feed_disponivel ?? null,
          feeds_encontrados: statusLoja?.feeds_encontrados ?? null,
          feeds_lidos: statusLoja?.feeds_lidos ?? null,
          total: statusLoja?.total_feed ?? null,
          elegiveis: statusLoja?.elegiveis ?? null,
          selecionados: statusLoja?.selecionados ?? null,
          links_ok: statusLoja?.links_afiliados_ok ?? null,
          links_falha: statusLoja?.links_afiliados_falha ?? null,
          criadas: statusLoja?.criadas ?? null,
          atualizadas: statusLoja?.atualizadas ?? null,
          expiradas: statusLoja?.expiradas ?? null,
          erro: statusLoja?.erro ?? null,
        },
        banco: {
          ativos: ativosResp.count ?? 0,
          pendentes: pendentesResp.count ?? 0,
          total: totalResp.count ?? 0,
          ultima_atualizacao:
            ultimoResp.data?.verificado_em ||
            ultimoResp.data?.coletado_em ||
            ultimoResp.data?.updated_at ||
            null,
        },
        parceiro: parceiro
          ? {
              status: parceiro.status,
              rede: parceiro.rede,
              integracoes: parceiro.integracoes || [],
              automacao_status: parceiro.automacao_status,
              pendencia: parceiro.pendencia,
              proximo_passo: parceiro.proximo_passo,
            }
          : null,
      });
    }

    return NextResponse.json({
      sucesso: true,
      sandbox: SANDBOX_NAME,
      atualizado_em: new Date().toISOString(),
      lojas,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[Saude AWIN] Falha:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : "Falha ao carregar saude AWIN." },
      { status: 500 }
    );
  }
}
