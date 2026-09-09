import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = new Set(["ativo", "pendente", "acao", "alvo", "pausado", "recusado"]);
const COMISSAO_TIPOS = new Set(["percentual", "fixa", "variavel", "desconhecida"]);
const AUTOMACOES = new Set(["ativa", "parcial", "manual", "nao_integrada"]);

async function autorizado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function slugificar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function listaTexto(valor: unknown) {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => texto(item)).filter(Boolean).slice(0, 30);
}

function payloadParceiro(body: any, parcial = false) {
  const payload: Record<string, unknown> = {};

  const definir = (campo: string, valor: unknown) => {
    if (!parcial || Object.prototype.hasOwnProperty.call(body || {}, campo)) payload[campo] = valor;
  };

  const nome = texto(body?.nome);
  definir("nome", nome);
  definir("slug", texto(body?.slug) || (nome ? slugificar(nome) : ""));
  definir("rede", texto(body?.rede) || null);

  const status = texto(body?.status) || "alvo";
  definir("status", STATUS.has(status) ? status : "alvo");

  const comissaoTipo = texto(body?.comissao_tipo) || "desconhecida";
  definir("comissao_tipo", COMISSAO_TIPOS.has(comissaoTipo) ? comissaoTipo : "desconhecida");
  definir("comissao_valor", numero(body?.comissao_valor));
  definir("comissao_texto", texto(body?.comissao_texto) || null);
  definir("integracoes", listaTexto(body?.integracoes));

  const automacao = texto(body?.automacao_status) || "nao_integrada";
  definir("automacao_status", AUTOMACOES.has(automacao) ? automacao : "nao_integrada");
  definir("painel_url", texto(body?.painel_url) || null);
  definir("programa_url", texto(body?.programa_url) || null);
  definir("pendencia", texto(body?.pendencia) || null);
  definir("proximo_passo", texto(body?.proximo_passo) || null);

  const prioridade = Math.min(5, Math.max(1, numero(body?.prioridade) ?? 3));
  definir("prioridade", prioridade);
  definir("observacoes", texto(body?.observacoes) || null);

  return payload;
}

export async function GET() {
  if (!(await autorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const [parceirosResp, checklistResp] = await Promise.all([
    supabaseAdmin
      .from("afiliados_parceiros")
      .select("*")
      .order("prioridade", { ascending: true })
      .order("nome", { ascending: true }),
    supabaseAdmin
      .from("afiliados_checklist")
      .select("*")
      .order("ordem", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (parceirosResp.error) {
    return NextResponse.json({ sucesso: false, erro: parceirosResp.error.message }, { status: 500 });
  }
  if (checklistResp.error) {
    return NextResponse.json({ sucesso: false, erro: checklistResp.error.message }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    parceiros: parceirosResp.data ?? [],
    checklist: checklistResp.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = payloadParceiro(body);

    if (!texto(payload.nome)) {
      return NextResponse.json({ sucesso: false, erro: "Informe o nome do parceiro." }, { status: 400 });
    }
    if (!texto(payload.slug)) {
      return NextResponse.json({ sucesso: false, erro: "Nao foi possivel gerar o identificador do parceiro." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("afiliados_parceiros")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const etapas = [
      ["Cadastro na rede/plataforma", 1],
      ["Programa/parceria aprovado", 2],
      ["Comissão registrada", 3],
      ["Link/painel conferido", 4],
      ["Integração no site concluída", 5],
      ["Automação validada", 6],
    ];

    const { error: checklistError } = await supabaseAdmin
      .from("afiliados_checklist")
      .insert(etapas.map(([etapa, ordem]) => ({ parceiro_id: data.id, etapa, ordem, concluido: false })));

    if (checklistError) console.error("[Parceiros] Falha criando checklist padrao:", checklistError);

    return NextResponse.json({ sucesso: true, parceiro: data }, { status: 201 });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro ao cadastrar parceiro.",
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = texto(body?.id);
    if (!id) return NextResponse.json({ sucesso: false, erro: "Parceiro invalido." }, { status: 400 });

    const payload = payloadParceiro(body, true);
    delete payload.id;

    if (Object.prototype.hasOwnProperty.call(payload, "nome") && !texto(payload.nome)) {
      return NextResponse.json({ sucesso: false, erro: "O nome nao pode ficar vazio." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("afiliados_parceiros")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, parceiro: data });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro ao editar parceiro.",
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await autorizado())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = texto(body?.id);
    if (!id) return NextResponse.json({ sucesso: false, erro: "Parceiro invalido." }, { status: 400 });

    const { error } = await supabaseAdmin.from("afiliados_parceiros").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ sucesso: true });
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : "Erro ao excluir parceiro.",
    }, { status: 500 });
  }
}
