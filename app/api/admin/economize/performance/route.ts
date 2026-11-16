import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_PERMITIDOS = new Set([7, 30, 90]);
const TRAFEGO_VALIDO = "humano_provavel";
const META_VIDEOS_SEMANA = 3;
const FUSO_CONTEUDO = "America/Sao_Paulo";

type ProdutoConteudo = {
  id: number;
  nome: string | null;
  loja: string | null;
  categoria: string | null;
  imagem: string | null;
  preco_atual: number | string | null;
  tem_em_casa: boolean | null;
  review_completa: boolean | null;
  video_url: string | null;
  video_publicado_em: string | null;
  updated_at: string | null;
  ativo: boolean | null;
};

type MetricasProduto = {
  cliquesHumanos: number;
  cliquesReview: number;
  ultimoClique: string | null;
};

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

function percentualVariacao(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function incrementar(mapa: Map<string, number>, chave: string | null | undefined) {
  const normalizada = String(chave || "desconhecido").trim() || "desconhecido";
  mapa.set(normalizada, (mapa.get(normalizada) || 0) + 1);
}

function textoPreenchido(valor: string | null | undefined) {
  return Boolean(valor?.trim());
}

function partesNoFuso(data: Date, timeZone: string) {
  const formatador = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const partes = Object.fromEntries(
    formatador
      .formatToParts(data)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
    semana: String(partes.weekday || "Mon"),
  };
}

function deslocamentoFuso(data: Date, timeZone: string) {
  const partes = partesNoFuso(data, timeZone);
  const representacaoUtc = Date.UTC(
    partes.ano,
    partes.mes - 1,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  );
  const instanteSemMilissegundos = Math.trunc(data.getTime() / 1000) * 1000;
  return representacaoUtc - instanteSemMilissegundos;
}

function horarioLocalParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  segundo: number,
  timeZone: string,
) {
  const representacaoLocal = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  let tentativa = new Date(representacaoLocal);
  let deslocamento = deslocamentoFuso(tentativa, timeZone);
  tentativa = new Date(representacaoLocal - deslocamento);

  const deslocamentoCorrigido = deslocamentoFuso(tentativa, timeZone);
  if (deslocamentoCorrigido !== deslocamento) {
    deslocamento = deslocamentoCorrigido;
    tentativa = new Date(representacaoLocal - deslocamento);
  }

  return tentativa;
}

function inicioSemanaNoFuso(agora: Date) {
  const partes = partesNoFuso(agora, FUSO_CONTEUDO);
  const indiceDia = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }[partes.semana] ?? 1;
  const diasDesdeSegunda = (indiceDia + 6) % 7;
  const calendario = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia));
  calendario.setUTCDate(calendario.getUTCDate() - diasDesdeSegunda);

  return horarioLocalParaUtc(
    calendario.getUTCFullYear(),
    calendario.getUTCMonth() + 1,
    calendario.getUTCDate(),
    0,
    0,
    0,
    FUSO_CONTEUDO,
  );
}

async function buscarOfertas(ids: string[]) {
  const resultado = new Map<
    string,
    { id: string; titulo: string; preco_oferta: number | null }
  >();

  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    if (lote.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .select("id,titulo,preco_oferta")
      .in("id", lote);
    if (error) {
      throw new Error(`Falha ao carregar ofertas da performance: ${error.message}`);
    }
    for (const item of data ?? []) resultado.set(item.id, item);
  }

  return resultado;
}

async function buscarLojas(ids: string[]) {
  const resultado = new Map<string, { id: string; nome: string; slug: string }>();

  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    if (lote.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("economize_lojas")
      .select("id,nome,slug")
      .in("id", lote);
    if (error) {
      throw new Error(`Falha ao carregar lojas da performance: ${error.message}`);
    }
    for (const item of data ?? []) resultado.set(item.id, item);
  }

  return resultado;
}

function metricasVazias(): MetricasProduto {
  return {
    cliquesHumanos: 0,
    cliquesReview: 0,
    ultimoClique: null,
  };
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const diasRecebidos = Number(request.nextUrl.searchParams.get("dias") || "30");
    const dias = DIAS_PERMITIDOS.has(diasRecebidos) ? diasRecebidos : 30;
    const agora = new Date();
    const inicioAtual = new Date(agora.getTime() - dias * 86400000);
    const inicioAnterior = new Date(agora.getTime() - dias * 2 * 86400000);
    const inicioSemana = inicioSemanaNoFuso(agora);

    const [{ data: cliques, error: erroCliques }, { data: produtosDados, error: erroProdutos }] =
      await Promise.all([
        supabaseAdmin
          .from("economize_cliques")
          .select(
            "oferta_id,produto_id,loja_id,origem,rota,session_id,clicado_em,trafego_tipo,trafego_motivo",
          )
          .gte("clicado_em", inicioAnterior.toISOString())
          .order("clicado_em", { ascending: false })
          .limit(10000),
        supabaseAdmin
          .from("produtos")
          .select(
            "id,nome,loja,categoria,imagem,preco_atual,tem_em_casa,review_completa,video_url,video_publicado_em,updated_at,ativo",
          )
          .order("updated_at", { ascending: false })
          .limit(2000),
      ]);

    if (erroCliques) {
      throw new Error(`Falha ao carregar cliques: ${erroCliques.message}`);
    }
    if (erroProdutos) {
      throw new Error(`Falha ao carregar produtos: ${erroProdutos.message}`);
    }

    const janelaAtual = (cliques ?? []).filter(
      (clique) => new Date(clique.clicado_em).getTime() >= inicioAtual.getTime(),
    );
    const janelaAnterior = (cliques ?? []).filter((clique) => {
      const tempo = new Date(clique.clicado_em).getTime();
      return tempo >= inicioAnterior.getTime() && tempo < inicioAtual.getTime();
    });

    const atuais = janelaAtual.filter(
      (clique) => clique.trafego_tipo === TRAFEGO_VALIDO,
    );
    const anteriores = janelaAnterior.filter(
      (clique) => clique.trafego_tipo === TRAFEGO_VALIDO,
    );

    const diagnostico = {
      humanoProvavel: atuais.length,
      bots: janelaAtual.filter((clique) => clique.trafego_tipo === "bot").length,
      interno: janelaAtual.filter((clique) => clique.trafego_tipo === "interno").length,
      naoClassificado: janelaAtual.filter(
        (clique) => clique.trafego_tipo === "nao_classificado",
      ).length,
      totalBruto: janelaAtual.length,
    };

    const ofertaIds = Array.from(
      new Set(atuais.map((clique) => clique.oferta_id).filter(Boolean)),
    ) as string[];
    const lojaIds = Array.from(
      new Set(atuais.map((clique) => clique.loja_id).filter(Boolean)),
    ) as string[];
    const [ofertas, lojas] = await Promise.all([
      buscarOfertas(ofertaIds),
      buscarLojas(lojaIds),
    ]);

    const produtos = (produtosDados ?? []) as ProdutoConteudo[];
    const produtosPorId = new Map(
      produtos.map((produto) => [Number(produto.id), produto]),
    );
    const porOrigem = new Map<string, number>();
    const porLoja = new Map<string, number>();
    const porItem = new Map<string, number>();
    const porProduto = new Map<number, MetricasProduto>();
    const sessoes = new Set<string>();
    const sessoesAnteriores = new Set<string>();

    for (const clique of atuais) {
      incrementar(porOrigem, clique.origem);
      if (clique.loja_id) incrementar(porLoja, clique.loja_id);
      if (clique.oferta_id) incrementar(porItem, `oferta:${clique.oferta_id}`);
      else if (clique.produto_id) incrementar(porItem, `produto:${clique.produto_id}`);
      if (clique.session_id) sessoes.add(clique.session_id);

      const produtoId = Number(clique.produto_id);
      if (Number.isFinite(produtoId) && produtoId > 0) {
        const metricas = porProduto.get(produtoId) ?? metricasVazias();
        metricas.cliquesHumanos += 1;
        if (
          clique.trafego_motivo === "review_afiliado_manual" ||
          String(clique.rota || "").includes("/review-ir")
        ) {
          metricas.cliquesReview += 1;
        }
        if (
          !metricas.ultimoClique ||
          new Date(clique.clicado_em).getTime() >
            new Date(metricas.ultimoClique).getTime()
        ) {
          metricas.ultimoClique = clique.clicado_em;
        }
        porProduto.set(produtoId, metricas);
      }
    }

    for (const clique of anteriores) {
      if (clique.session_id) sessoesAnteriores.add(clique.session_id);
    }

    const origens = Array.from(porOrigem.entries())
      .map(([origem, quantidade]) => ({
        origem,
        quantidade,
        percentual: atuais.length
          ? Math.round((quantidade / atuais.length) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const topLojas = Array.from(porLoja.entries())
      .map(([lojaId, quantidade]) => ({
        lojaId,
        loja: lojas.get(lojaId)?.nome || "Loja não identificada",
        slug: lojas.get(lojaId)?.slug || null,
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    const topOfertas = Array.from(porItem.entries())
      .map(([chave, quantidade]) => {
        if (chave.startsWith("produto:")) {
          const produtoId = Number(chave.slice(8));
          const produto = produtosPorId.get(produtoId);
          return {
            ofertaId: chave,
            titulo: produto?.nome || "Produto não identificado",
            preco: produto?.preco_atual ? Number(produto.preco_atual) : null,
            loja: produto?.loja || "Loja",
            quantidade,
          };
        }

        const ofertaId = chave.slice(7);
        return {
          ofertaId,
          titulo: ofertas.get(ofertaId)?.titulo || "Oferta não identificada",
          preco: ofertas.get(ofertaId)?.preco_oferta ?? null,
          loja:
            lojas.get(
              atuais.find((clique) => clique.oferta_id === ofertaId)?.loja_id || "",
            )?.nome || "Loja",
          quantidade,
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    const produtosAtivos = produtos.filter((produto) => produto.ativo !== false);
    const enriquecer = (produto: ProdutoConteudo) => {
      const metricas = porProduto.get(Number(produto.id)) ?? metricasVazias();
      return {
        id: Number(produto.id),
        nome: produto.nome || "Produto sem nome",
        loja: produto.loja || "Loja",
        categoria: produto.categoria || "Sem categoria",
        imagem: produto.imagem || null,
        preco: produto.preco_atual ? Number(produto.preco_atual) : null,
        temEmCasa: Boolean(produto.tem_em_casa),
        reviewCompleta: Boolean(produto.review_completa),
        videoUrl: produto.video_url || null,
        videoPublicadoEm: produto.video_publicado_em || null,
        atualizadoEm: produto.updated_at || null,
        ...metricas,
      };
    };

    const filaGravacao = produtosAtivos
      .filter(
        (produto) => produto.tem_em_casa && !textoPreenchido(produto.video_url),
      )
      .map(enriquecer)
      .sort((a, b) => {
        if (a.cliquesReview !== b.cliquesReview) {
          return b.cliquesReview - a.cliquesReview;
        }
        if (a.cliquesHumanos !== b.cliquesHumanos) {
          return b.cliquesHumanos - a.cliquesHumanos;
        }
        if (a.reviewCompleta !== b.reviewCompleta) {
          return Number(b.reviewCompleta) - Number(a.reviewCompleta);
        }
        return (
          new Date(b.atualizadoEm || 0).getTime() -
          new Date(a.atualizadoEm || 0).getTime()
        );
      })
      .slice(0, 12);

    const videosPublicados = produtosAtivos
      .filter((produto) => textoPreenchido(produto.video_url))
      .map(enriquecer)
      .sort(
        (a, b) =>
          new Date(b.videoPublicadoEm || b.atualizadoEm || 0).getTime() -
          new Date(a.videoPublicadoEm || a.atualizadoEm || 0).getTime(),
      )
      .slice(0, 12);

    const oportunidadesDemanda = produtosAtivos
      .filter((produto) => {
        const metricas = porProduto.get(Number(produto.id));
        return (
          !produto.tem_em_casa &&
          !textoPreenchido(produto.video_url) &&
          Boolean(metricas?.cliquesHumanos)
        );
      })
      .map(enriquecer)
      .sort((a, b) => b.cliquesHumanos - a.cliquesHumanos)
      .slice(0, 8);

    const videosSemana = videosPublicados.filter(
      (produto) =>
        produto.videoPublicadoEm &&
        new Date(produto.videoPublicadoEm).getTime() >= inicioSemana.getTime(),
    ).length;
    const faltamVideos = Math.max(0, META_VIDEOS_SEMANA - videosSemana);
    const cliquesProdutosHumanos = atuais.filter((clique) =>
      Number.isFinite(Number(clique.produto_id)),
    ).length;
    const cliquesReviewsHumanos = atuais.filter(
      (clique) =>
        Number.isFinite(Number(clique.produto_id)) &&
        (clique.trafego_motivo === "review_afiliado_manual" ||
          String(clique.rota || "").includes("/review-ir")),
    ).length;

    return NextResponse.json(
      {
        periodo: {
          dias,
          inicio: inicioAtual.toISOString(),
          fim: agora.toISOString(),
        },
        filtro: {
          trafego: TRAFEGO_VALIDO,
          descricao:
            "Métricas principais usam apenas tráfego classificado como humano provável.",
        },
        resumo: {
          cliques: atuais.length,
          sessoes: sessoes.size,
          cliquesPorSessao: sessoes.size
            ? Math.round((atuais.length / sessoes.size) * 100) / 100
            : 0,
          canaisAtivos: origens.filter((item) => item.quantidade > 0).length,
          variacaoCliques: percentualVariacao(atuais.length, anteriores.length),
          variacaoSessoes: percentualVariacao(
            sessoes.size,
            sessoesAnteriores.size,
          ),
        },
        diagnostico,
        conteudo: {
          metaSemanal: META_VIDEOS_SEMANA,
          videosSemana,
          faltamVideos,
          progressoPercentual: Math.min(
            100,
            Math.round((videosSemana / META_VIDEOS_SEMANA) * 100),
          ),
          inicioSemana: inicioSemana.toISOString(),
          fimSemana: agora.toISOString(),
          produtosEmCasa: produtosAtivos.filter((produto) => produto.tem_em_casa)
            .length,
          reviewsCompletas: produtosAtivos.filter(
            (produto) => produto.review_completa,
          ).length,
          reviewsComVideo: videosPublicados.length,
          filaSemVideo: filaGravacao.length,
          cliquesProdutosHumanos,
          cliquesReviewsHumanos,
        },
        filaGravacao,
        candidatosFila: produtosAtivos
          .filter(
            (produto) =>
              !produto.tem_em_casa &&
              !textoPreenchido(produto.video_url),
          )
          .map(enriquecer)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          .slice(0, 200),
        videosPublicados,
        oportunidadesDemanda,
        origens,
        topLojas,
        topOfertas,
        limiteAmostra: 10000,
        atualizadoEm: agora.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Erro na API de performance:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}


export async function POST(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const corpo = (await request.json()) as Record<string, unknown>;
    const produtoId = Number(corpo.produtoId);

    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      return NextResponse.json(
        { error: "Produto inválido." },
        { status: 400 },
      );
    }

    const { data: produto, error: erroProduto } = await supabaseAdmin
      .from("produtos")
      .select("id,nome,ativo,tem_em_casa,video_url")
      .eq("id", produtoId)
      .maybeSingle();

    if (erroProduto) {
      throw new Error(`Falha ao localizar produto: ${erroProduto.message}`);
    }
    if (!produto || produto.ativo === false) {
      return NextResponse.json(
        { error: "Produto não encontrado ou inativo." },
        { status: 404 },
      );
    }
    if (textoPreenchido(produto.video_url)) {
      return NextResponse.json(
        { error: "Este produto já possui vídeo publicado." },
        { status: 409 },
      );
    }

    const { data: atualizado, error: erroAtualizacao } = await supabaseAdmin
      .from("produtos")
      .update({
        tem_em_casa: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", produtoId)
      .select("id,nome,tem_em_casa")
      .single();

    if (erroAtualizacao || !atualizado) {
      throw new Error(
        `Falha ao adicionar à fila: ${erroAtualizacao?.message || "erro desconhecido"}`,
      );
    }

    return NextResponse.json({
      sucesso: true,
      produto: atualizado,
      mensagem: "Produto adicionado à fila de próximos vídeos.",
    });
  } catch (error) {
    console.error("Erro ao adicionar produto à fila de vídeos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
