import { NextRequest, NextResponse } from "next/server";
import {
  ATRIBUICAO_MAX_AGE_SEGUNDOS,
  CAMPANHAS_RASTREADAS,
} from "@/lib/economize/campaignAttribution";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_PERMITIDOS = new Set([7, 30, 90]);
const CAMPANHA_PADRAO = "black_friday_2026";
const BASE_PUBLICA = "https://achadosdocasal.com.br";
const ORDEM_CODIGOS = ["black-gabriel", "black-bruna", "black-achados"];

type VisitaCampanha = {
  id: number;
  codigo: string;
  content: string;
  session_id: string;
  trafego_tipo: string;
  visitado_em: string;
};

type CliqueAtribuido = {
  campanha_visita_id: number | null;
  produto_id: number | null;
  oferta_id: string | null;
  session_id: string | null;
  clicado_em: string;
  trafego_tipo: string;
  trafego_motivo: string | null;
  rota: string | null;
};

type ItemCatalogo = {
  chave: string;
  tipo: "produto" | "oferta";
  titulo: string;
  loja: string;
  preco: number | null;
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

function percentual(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

function chaveItem(clique: CliqueAtribuido) {
  if (clique.produto_id) return `produto:${clique.produto_id}`;
  if (clique.oferta_id) return `oferta:${clique.oferta_id}`;
  return null;
}

function ehCliqueReview(clique: CliqueAtribuido) {
  return (
    clique.trafego_motivo === "review_afiliado_manual" ||
    String(clique.rota || "").includes("/review-ir")
  );
}

function lojaRelacionada(valor: unknown) {
  if (Array.isArray(valor)) {
    const primeiro = valor[0] as { nome?: string } | undefined;
    return primeiro?.nome || "Loja";
  }
  if (valor && typeof valor === "object") {
    return (valor as { nome?: string }).nome || "Loja";
  }
  return "Loja";
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
    const inicioAtribuicoes = new Date(
      inicioAnterior.getTime() - ATRIBUICAO_MAX_AGE_SEGUNDOS * 1000,
    );

    const [
      { data: visitasDados, error: erroVisitas },
      { data: cliquesDados, error: erroCliques },
    ] = await Promise.all([
      supabaseAdmin
        .from("economize_campanha_visitas")
        .select("id,codigo,content,session_id,trafego_tipo,visitado_em")
        .eq("campaign", CAMPANHA_PADRAO)
        .gte("visitado_em", inicioAtribuicoes.toISOString())
        .order("visitado_em", { ascending: false })
        .limit(10000),
      supabaseAdmin
        .from("economize_cliques")
        .select(
          "campanha_visita_id,produto_id,oferta_id,session_id,clicado_em,trafego_tipo,trafego_motivo,rota",
        )
        .not("campanha_visita_id", "is", null)
        .gte("clicado_em", inicioAnterior.toISOString())
        .order("clicado_em", { ascending: false })
        .limit(10000),
    ]);

    if (erroVisitas) {
      throw new Error(
        `Falha ao carregar visitas de campanha: ${erroVisitas.message}`,
      );
    }
    if (erroCliques) {
      throw new Error(`Falha ao carregar cliques atribuídos: ${erroCliques.message}`);
    }

    const visitas = (visitasDados ?? []) as VisitaCampanha[];
    const cliques = (cliquesDados ?? []) as CliqueAtribuido[];
    const visitaPorId = new Map(
      visitas.map((visita) => [Number(visita.id), visita]),
    );

    const visitasAtuais = visitas.filter(
      (visita) =>
        new Date(visita.visitado_em).getTime() >= inicioAtual.getTime(),
    );
    const visitasAnteriores = visitas.filter((visita) => {
      const instante = new Date(visita.visitado_em).getTime();
      return instante >= inicioAnterior.getTime() && instante < inicioAtual.getTime();
    });
    const cliquesAtuais = cliques.filter(
      (clique) =>
        new Date(clique.clicado_em).getTime() >= inicioAtual.getTime() &&
        clique.trafego_tipo === "humano_provavel" &&
        visitaPorId.has(Number(clique.campanha_visita_id)),
    );
    const cliquesAnteriores = cliques.filter((clique) => {
      const instante = new Date(clique.clicado_em).getTime();
      return (
        instante >= inicioAnterior.getTime() &&
        instante < inicioAtual.getTime() &&
        clique.trafego_tipo === "humano_provavel" &&
        visitaPorId.has(Number(clique.campanha_visita_id))
      );
    });

    const visitasHumanasAtuais = visitasAtuais.filter(
      (visita) => visita.trafego_tipo === "humano_provavel",
    );
    const visitasHumanasAnteriores = visitasAnteriores.filter(
      (visita) => visita.trafego_tipo === "humano_provavel",
    );
    const idsVisitasHumanasAtuais = new Set(
      visitasHumanasAtuais.map((visita) => Number(visita.id)),
    );

    const produtoIds = Array.from(
      new Set(
        cliquesAtuais
          .map((clique) => Number(clique.produto_id))
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    );
    const ofertaIds = Array.from(
      new Set(
        cliquesAtuais
          .map((clique) => clique.oferta_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const [produtosResposta, ofertasResposta] = await Promise.all([
      produtoIds.length
        ? supabaseAdmin
            .from("produtos")
            .select("id,nome,loja,preco_atual")
            .in("id", produtoIds)
        : Promise.resolve({ data: [], error: null }),
      ofertaIds.length
        ? supabaseAdmin
            .from("economize_ofertas")
            .select("id,titulo,preco_oferta,loja:economize_lojas(nome)")
            .in("id", ofertaIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (produtosResposta.error) {
      throw new Error(
        `Falha ao carregar produtos da campanha: ${produtosResposta.error.message}`,
      );
    }
    if (ofertasResposta.error) {
      throw new Error(
        `Falha ao carregar ofertas da campanha: ${ofertasResposta.error.message}`,
      );
    }

    const catalogo = new Map<string, ItemCatalogo>();
    for (const produto of produtosResposta.data ?? []) {
      catalogo.set(`produto:${produto.id}`, {
        chave: `produto:${produto.id}`,
        tipo: "produto",
        titulo: produto.nome || "Produto não identificado",
        loja: produto.loja || "Loja",
        preco:
          produto.preco_atual === null ? null : Number(produto.preco_atual),
      });
    }
    for (const oferta of ofertasResposta.data ?? []) {
      catalogo.set(`oferta:${oferta.id}`, {
        chave: `oferta:${oferta.id}`,
        tipo: "oferta",
        titulo: oferta.titulo || "Oferta não identificada",
        loja: lojaRelacionada(oferta.loja),
        preco:
          oferta.preco_oferta === null ? null : Number(oferta.preco_oferta),
      });
    }

    const perfis = ORDEM_CODIGOS.map((codigo) => {
      const definicao = CAMPANHAS_RASTREADAS[codigo];
      const visitasPerfil = visitasHumanasAtuais.filter(
        (visita) => visita.content === definicao.content,
      );
      const visitasPerfilAnterior = visitasHumanasAnteriores.filter(
        (visita) => visita.content === definicao.content,
      );
      const idsVisitasPerfil = new Set(
        visitasPerfil.map((visita) => Number(visita.id)),
      );
      const cliquesPerfil = cliquesAtuais.filter((clique) => {
        const visita = visitaPorId.get(Number(clique.campanha_visita_id));
        return visita?.content === definicao.content;
      });
      const cliquesPerfilAnterior = cliquesAnteriores.filter((clique) => {
        const visita = visitaPorId.get(Number(clique.campanha_visita_id));
        return visita?.content === definicao.content;
      });
      const cliquesCoortePerfil = cliquesPerfil.filter((clique) =>
        idsVisitasPerfil.has(Number(clique.campanha_visita_id)),
      );
      const sessoesVisita = new Set(
        visitasPerfil.map((visita) => visita.session_id),
      );
      const sessoesComClique = new Set(
        cliquesCoortePerfil
          .map(
            (clique) =>
              visitaPorId.get(Number(clique.campanha_visita_id))?.session_id,
          )
          .filter((sessao): sessao is string => Boolean(sessao)),
      );
      const porItem = new Map<string, number>();

      for (const clique of cliquesPerfil) {
        const chave = chaveItem(clique);
        if (!chave) continue;
        porItem.set(chave, (porItem.get(chave) || 0) + 1);
      }

      const topItens = Array.from(porItem.entries())
        .map(([chave, quantidade]) => ({
          ...(catalogo.get(chave) || {
            chave,
            tipo: chave.startsWith("produto:") ? "produto" : "oferta",
            titulo: "Item não identificado",
            loja: "Loja",
            preco: null,
          }),
          quantidade,
        }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      return {
        codigo: definicao.codigo,
        nome: definicao.nome,
        content: definicao.content,
        link: `${BASE_PUBLICA}/ig/${definicao.codigo}`,
        visitas: visitasPerfil.length,
        sessoes: sessoesVisita.size,
        cliques: cliquesPerfil.length,
        sessoesComClique: sessoesComClique.size,
        conversao: percentual(sessoesComClique.size, sessoesVisita.size),
        cliquesReview: cliquesPerfil.filter(ehCliqueReview).length,
        cliquesProdutos: cliquesPerfil.filter((clique) =>
          Boolean(clique.produto_id),
        ).length,
        cliquesOfertas: cliquesPerfil.filter((clique) =>
          Boolean(clique.oferta_id),
        ).length,
        variacaoVisitas: percentualVariacao(
          visitasPerfil.length,
          visitasPerfilAnterior.length,
        ),
        variacaoCliques: percentualVariacao(
          cliquesPerfil.length,
          cliquesPerfilAnterior.length,
        ),
        topItens,
      };
    });

    const sessoesHumanas = new Set(
      visitasHumanasAtuais.map((visita) => visita.session_id),
    );
    const cliquesCoorteAtual = cliquesAtuais.filter((clique) =>
      idsVisitasHumanasAtuais.has(Number(clique.campanha_visita_id)),
    );
    const sessoesComClique = new Set(
      cliquesCoorteAtual
        .map(
          (clique) =>
            visitaPorId.get(Number(clique.campanha_visita_id))?.session_id,
        )
        .filter((sessao): sessao is string => Boolean(sessao)),
    );

    return NextResponse.json(
      {
        campanha: {
          id: CAMPANHA_PADRAO,
          nome: "Black Friday 2026",
          source: "instagram",
          medium: "social",
          atribuicaoDias: Math.round(ATRIBUICAO_MAX_AGE_SEGUNDOS / 86400),
        },
        periodo: {
          dias,
          inicio: inicioAtual.toISOString(),
          fim: agora.toISOString(),
        },
        resumo: {
          visitas: visitasHumanasAtuais.length,
          sessoes: sessoesHumanas.size,
          cliques: cliquesAtuais.length,
          sessoesComClique: sessoesComClique.size,
          conversao: percentual(sessoesComClique.size, sessoesHumanas.size),
          cliquesReview: cliquesAtuais.filter(ehCliqueReview).length,
          cliquesProdutos: cliquesAtuais.filter((clique) =>
            Boolean(clique.produto_id),
          ).length,
          cliquesOfertas: cliquesAtuais.filter((clique) =>
            Boolean(clique.oferta_id),
          ).length,
          variacaoVisitas: percentualVariacao(
            visitasHumanasAtuais.length,
            visitasHumanasAnteriores.length,
          ),
          variacaoCliques: percentualVariacao(
            cliquesAtuais.length,
            cliquesAnteriores.length,
          ),
        },
        diagnostico: {
          humanos: visitasHumanasAtuais.length,
          bots: visitasAtuais.filter((visita) => visita.trafego_tipo === "bot")
            .length,
          internos: visitasAtuais.filter(
            (visita) => visita.trafego_tipo === "interno",
          ).length,
          naoClassificados: visitasAtuais.filter(
            (visita) => visita.trafego_tipo === "nao_classificado",
          ).length,
          bruto: visitasAtuais.length,
        },
        perfis,
        atualizadoEm: agora.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Erro no painel de campanhas:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
