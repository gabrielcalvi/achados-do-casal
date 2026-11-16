import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_PERMITIDOS = new Set([7, 30, 90]);

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

function numeroOpcional(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function textoOpcional(valor: unknown, limite = 240) {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto ? texto.slice(0, limite) : null;
}

function percentual(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 10000) / 100;
}

export async function GET(request: NextRequest) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const diasRecebidos = Number(request.nextUrl.searchParams.get("dias") || "30");
    const dias = DIAS_PERMITIDOS.has(diasRecebidos) ? diasRecebidos : 30;
    const agora = new Date();
    const inicio = new Date(agora.getTime() - dias * 86400000);
    const inicioAnterior = new Date(agora.getTime() - dias * 2 * 86400000);

    const [{ data: vendas, error: erroVendas }, { data: cliques, error: erroCliques }] =
      await Promise.all([
        supabaseAdmin
          .from("economize_vendas")
          .select(
            "id,data_venda,status,origem,loja,produto,programa_afiliado,valor_venda,comissao,moeda,fonte,external_id,produto_id,oferta_id,campanha_visita_id,observacoes,created_at",
          )
          .gte("data_venda", inicioAnterior.toISOString().slice(0, 10))
          .order("data_venda", { ascending: false })
          .order("id", { ascending: false })
          .limit(1000),
        supabaseAdmin
          .from("economize_cliques")
          .select("clicado_em,trafego_tipo,session_id")
          .eq("trafego_tipo", "humano_provavel")
          .gte("clicado_em", inicioAnterior.toISOString())
          .order("clicado_em", { ascending: false })
          .limit(10000),
      ]);

    if (erroVendas) throw new Error(`Falha ao carregar vendas: ${erroVendas.message}`);
    if (erroCliques) throw new Error(`Falha ao carregar cliques: ${erroCliques.message}`);

    const inicioMs = inicio.getTime();
    const inicioAnteriorMs = inicioAnterior.getTime();
    const vendasAtuais = (vendas ?? []).filter(
      (venda) => new Date(`${venda.data_venda}T12:00:00Z`).getTime() >= inicioMs,
    );
    const vendasAnteriores = (vendas ?? []).filter((venda) => {
      const tempo = new Date(`${venda.data_venda}T12:00:00Z`).getTime();
      return tempo >= inicioAnteriorMs && tempo < inicioMs;
    });
    const cliquesAtuais = (cliques ?? []).filter(
      (clique) => new Date(clique.clicado_em).getTime() >= inicioMs,
    );
    const cliquesAnteriores = (cliques ?? []).filter((clique) => {
      const tempo = new Date(clique.clicado_em).getTime();
      return tempo >= inicioAnteriorMs && tempo < inicioMs;
    });

    const confirmadas = vendasAtuais.filter((venda) => venda.status === "confirmada");
    const pendentes = vendasAtuais.filter((venda) => venda.status === "pendente");
    const canceladas = vendasAtuais.filter((venda) => venda.status === "cancelada");
    const confirmadasAnteriores = vendasAnteriores.filter(
      (venda) => venda.status === "confirmada",
    );

    const valorVendido = confirmadas.reduce(
      (total, venda) => total + Number(venda.valor_venda || 0),
      0,
    );
    const comissaoGerada = confirmadas.reduce(
      (total, venda) => total + Number(venda.comissao || 0),
      0,
    );

    const porLoja = new Map<string, { vendas: number; valor: number; comissao: number }>();
    const porCanal = new Map<string, { vendas: number; valor: number; comissao: number }>();

    for (const venda of confirmadas) {
      const loja = String(venda.loja || "Não informada");
      const canal = String(venda.origem || "Não informado");
      const valor = Number(venda.valor_venda || 0);
      const comissao = Number(venda.comissao || 0);

      const lojaAtual = porLoja.get(loja) || { vendas: 0, valor: 0, comissao: 0 };
      lojaAtual.vendas += 1;
      lojaAtual.valor += valor;
      lojaAtual.comissao += comissao;
      porLoja.set(loja, lojaAtual);

      const canalAtual = porCanal.get(canal) || { vendas: 0, valor: 0, comissao: 0 };
      canalAtual.vendas += 1;
      canalAtual.valor += valor;
      canalAtual.comissao += comissao;
      porCanal.set(canal, canalAtual);
    }

    const variacaoVendas =
      confirmadasAnteriores.length === 0
        ? confirmadas.length > 0
          ? 100
          : 0
        : Math.round(
            ((confirmadas.length - confirmadasAnteriores.length) /
              confirmadasAnteriores.length) *
              1000,
          ) / 10;

    return NextResponse.json(
      {
        periodo: {
          dias,
          inicio: inicio.toISOString(),
          fim: agora.toISOString(),
        },
        resumo: {
          vendasConfirmadas: confirmadas.length,
          vendasPendentes: pendentes.length,
          vendasCanceladas: canceladas.length,
          valorVendido: Math.round(valorVendido * 100) / 100,
          comissaoGerada: Math.round(comissaoGerada * 100) / 100,
          cliquesHumanos: cliquesAtuais.length,
          sessoesHumanas: new Set(cliquesAtuais.map((clique) => clique.session_id).filter(Boolean))
            .size,
          taxaCliqueVenda: percentual(confirmadas.length, cliquesAtuais.length),
          variacaoVendas,
          vendasPeriodoAnterior: confirmadasAnteriores.length,
          cliquesPeriodoAnterior: cliquesAnteriores.length,
        },
        porLoja: Array.from(porLoja.entries())
          .map(([nome, metricas]) => ({ nome, ...metricas }))
          .sort((a, b) => b.vendas - a.vendas || b.valor - a.valor),
        porCanal: Array.from(porCanal.entries())
          .map(([nome, metricas]) => ({ nome, ...metricas }))
          .sort((a, b) => b.vendas - a.vendas || b.valor - a.valor),
        vendas: vendasAtuais.slice(0, 100).map((venda) => ({
          ...venda,
          valor_venda:
            venda.valor_venda === null ? null : Number(venda.valor_venda),
          comissao: venda.comissao === null ? null : Number(venda.comissao),
        })),
        atualizadoEm: agora.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Erro nos resultados comerciais:", error);
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
    const dataVenda =
      typeof corpo.dataVenda === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dataVenda)
        ? corpo.dataVenda
        : null;

    if (!dataVenda) {
      return NextResponse.json(
        { error: "Informe uma data de venda válida." },
        { status: 400 },
      );
    }

    const status =
      corpo.status === "pendente" || corpo.status === "cancelada"
        ? corpo.status
        : "confirmada";
    const origem = textoOpcional(corpo.origem, 120) || "site";
    const fonte = textoOpcional(corpo.fonte, 120) || "manual";

    const { data, error } = await supabaseAdmin
      .from("economize_vendas")
      .insert({
        data_venda: dataVenda,
        status,
        origem,
        loja: textoOpcional(corpo.loja),
        produto: textoOpcional(corpo.produto, 500),
        programa_afiliado: textoOpcional(corpo.programaAfiliado),
        valor_venda: numeroOpcional(corpo.valorVenda),
        comissao: numeroOpcional(corpo.comissao),
        moeda: textoOpcional(corpo.moeda, 8) || "BRL",
        fonte,
        external_id: textoOpcional(corpo.externalId),
        observacoes: textoOpcional(corpo.observacoes, 1200),
      })
      .select(
        "id,data_venda,status,origem,loja,produto,programa_afiliado,valor_venda,comissao,moeda,fonte,observacoes,created_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Esta venda já foi importada ou cadastrada." },
          { status: 409 },
        );
      }
      throw new Error(`Falha ao registrar venda: ${error.message}`);
    }

    return NextResponse.json({ venda: data }, { status: 201 });
  } catch (error) {
    console.error("Erro ao registrar venda:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  }
}
