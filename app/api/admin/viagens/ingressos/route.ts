import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioAtual() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return error ? null : user;
  } catch {
    return null;
  }
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function urlValida(valor: string) {
  if (!valor) return false;
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function payloadDoBody(body: any) {
  const titulo = texto(body?.titulo);
  const parceiro = texto(body?.parceiro) || "Decolar";
  const linkOriginal = texto(body?.link_original);
  const linkAfiliado = texto(body?.link_afiliado);
  const atracaoNome = texto(body?.atracao_nome);
  const cidadeUf = texto(body?.cidade_uf);
  const dataUso = texto(body?.data_uso);
  const adultos = numero(body?.adultos) ?? 1;
  const criancas = numero(body?.criancas) ?? 0;
  const precoTotal = numero(body?.preco_total);
  const precoPorPessoa = numero(body?.preco_por_pessoa);
  const imagemUrl = texto(body?.imagem_url);

  if (!titulo) throw new Error("Informe o titulo do ingresso.");
  if (!atracaoNome) throw new Error("Informe a atracao.");
  if (!linkAfiliado || !urlValida(linkAfiliado)) throw new Error("Informe um link afiliado valido.");
  if (linkOriginal && !urlValida(linkOriginal)) throw new Error("O link original e invalido.");
  if (imagemUrl && !urlValida(imagemUrl)) throw new Error("A URL da imagem e invalida.");
  if (precoTotal === null || precoTotal <= 0) throw new Error("Informe o preco do ingresso.");

  return {
    status: texto(body?.status) || "rascunho",
    titulo,
    parceiro,
    link_original: linkOriginal || null,
    link_afiliado: linkAfiliado,
    atracao_nome: atracaoNome,
    cidade_uf: cidadeUf || null,
    data_uso: dataUso || null,
    adultos,
    criancas,
    preco_total: precoTotal,
    preco_por_pessoa: precoPorPessoa,
    moeda: texto(body?.moeda) || "BRL",
    imagem_url: imagemUrl || null,
    observacoes: texto(body?.observacoes) || null,
    validade: texto(body?.validade) || null,
    destaque: Boolean(body?.destaque),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  if (!(await usuarioAtual())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("viagens_ingressos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ sucesso: true, ingressos: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = { ...payloadDoBody(body), created_by: user.id };
    const { data, error } = await supabaseAdmin
      .from("viagens_ingressos")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, ingresso: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ sucesso: false, erro: error instanceof Error ? error.message : "Erro ao cadastrar ingresso." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await usuarioAtual())) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = texto(body?.id);
    if (!id) throw new Error("Ingresso invalido para edicao.");

    const { data, error } = await supabaseAdmin
      .from("viagens_ingressos")
      .update(payloadDoBody(body))
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, ingresso: data });
  } catch (error) {
    return NextResponse.json({ sucesso: false, erro: error instanceof Error ? error.message : "Erro ao editar ingresso." }, { status: 400 });
  }
}
