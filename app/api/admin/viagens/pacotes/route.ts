import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["pacote", "hotel", "ingresso", "carro", "cruzeiro", "passeio", "outro"] as const;
type TipoOferta = (typeof TIPOS)[number];

async function usuarioAtual() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return error || !user ? null : user;
  } catch {
    return null;
  }
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown) {
  if (valor === "" || valor == null) return null;
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
}

function numeroPositivoOuNull(valor: unknown) {
  const resultado = numero(valor);
  return resultado != null && resultado > 0 ? resultado : null;
}

function urlValida(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function tipoValido(valor: unknown): TipoOferta {
  const tipo = texto(valor).toLowerCase();
  return TIPOS.includes(tipo as TipoOferta) ? (tipo as TipoOferta) : "pacote";
}

function requerDatas(tipo: TipoOferta) {
  return ["pacote", "hotel", "carro", "cruzeiro"].includes(tipo);
}

function requerNoites(tipo: TipoOferta) {
  return ["pacote", "hotel", "cruzeiro"].includes(tipo);
}

function validar(body: any) {
  const tipo = tipoValido(body?.tipo);
  const titulo = texto(body?.titulo);
  const linkOriginal = texto(body?.link_original);
  const linkAfiliado = texto(body?.link_afiliado);
  const dataIda = texto(body?.data_ida);
  const dataVolta = texto(body?.data_volta);
  const origem = texto(body?.origem_codigo).toUpperCase();
  const destino = texto(body?.destino_codigo).toUpperCase();
  const hotel = texto(body?.hotel_nome);
  const localNome = texto(body?.local_nome);
  const noites = numero(body?.noites);
  const precoTotal = numero(body?.preco_total);
  const imagemUrl = texto(body?.imagem_url);

  if (!titulo) return { tipo, erro: "Informe o titulo da oferta." };
  if (!linkAfiliado || !urlValida(linkAfiliado)) return { tipo, erro: "Informe um link afiliado valido." };
  if (linkOriginal && !urlValida(linkOriginal)) return { tipo, erro: "O link original e invalido." };
  if (!precoTotal || precoTotal <= 0) return { tipo, erro: "Informe o preco da oferta." };
  if (imagemUrl && !urlValida(imagemUrl)) return { tipo, erro: "A URL da imagem e invalida." };

  if (requerDatas(tipo)) {
    if (!dataIda || !dataVolta || dataVolta < dataIda) return { tipo, erro: "Confira as datas da oferta." };
  } else if (dataIda && dataVolta && dataVolta < dataIda) {
    return { tipo, erro: "A data final nao pode ser anterior a data inicial." };
  }

  if (requerNoites(tipo) && (!noites || noites <= 0)) {
    return { tipo, erro: "Informe a quantidade de noites." };
  }

  if (tipo === "pacote") {
    if (!origem || !destino) return { tipo, erro: "Informe os aeroportos de origem e destino." };
    if (!hotel) return { tipo, erro: "Informe o hotel do pacote." };
  }
  if (tipo === "hotel" && !hotel) return { tipo, erro: "Informe o nome do hotel." };
  if (tipo === "ingresso" && !localNome) return { tipo, erro: "Informe a atracao ou local do ingresso." };
  if (tipo === "carro" && !localNome) return { tipo, erro: "Informe o local de retirada do carro." };
  if (tipo === "cruzeiro" && !localNome) return { tipo, erro: "Informe o porto de embarque." };
  if (tipo === "passeio" && !localNome) return { tipo, erro: "Informe a atracao ou local do passeio." };

  return { tipo, erro: null as string | null };
}

function payload(body: any, tipo: TipoOferta, createdBy?: string) {
  const precoTotal = numero(body?.preco_total);
  const taxas = numeroPositivoOuNull(body?.impostos_taxas_encargos);
  const totalFinal =
    numeroPositivoOuNull(body?.preco_total_final) ||
    (precoTotal && taxas ? precoTotal + taxas : null);

  const dados: Record<string, unknown> = {
    tipo,
    status: texto(body?.status) || "rascunho",
    titulo: texto(body?.titulo),
    parceiro: texto(body?.parceiro) || "Decolar",
    link_original: texto(body?.link_original) || null,
    link_afiliado: texto(body?.link_afiliado),
    radar_slug: tipo === "pacote" ? texto(body?.radar_slug) || null : null,
    radar_preco_referencia: tipo === "pacote" ? numero(body?.radar_preco_referencia) : null,
    radar_ida_referencia: tipo === "pacote" ? texto(body?.radar_ida_referencia) || null : null,
    radar_volta_referencia: tipo === "pacote" ? texto(body?.radar_volta_referencia) || null : null,
    origem_codigo: tipo === "pacote" ? texto(body?.origem_codigo).toUpperCase() || null : null,
    destino_codigo: tipo === "pacote" ? texto(body?.destino_codigo).toUpperCase() || null : null,
    destino_nome: texto(body?.destino_nome) || null,
    local_nome: texto(body?.local_nome) || null,
    cidade_uf: texto(body?.cidade_uf) || null,
    data_ida: texto(body?.data_ida) || null,
    data_volta: texto(body?.data_volta) || null,
    hotel_nome: ["pacote", "hotel"].includes(tipo) ? texto(body?.hotel_nome) || null : null,
    hotel_categoria: ["pacote", "hotel"].includes(tipo) ? texto(body?.hotel_categoria) || null : null,
    regime_hospedagem: ["pacote", "hotel"].includes(tipo) ? texto(body?.regime_hospedagem) || null : null,
    noites: requerNoites(tipo) ? numero(body?.noites) : null,
    adultos: Math.max(1, numero(body?.adultos) ?? 2),
    criancas: Math.max(0, numero(body?.criancas) ?? 0),
    companhia_aerea: tipo === "pacote" ? texto(body?.companhia_aerea) || null : null,
    bagagem: tipo === "pacote" ? texto(body?.bagagem) || null : null,
    preco_total: precoTotal,
    impostos_taxas_encargos: taxas,
    preco_total_final: totalFinal,
    preco_por_pessoa: numeroPositivoOuNull(body?.preco_por_pessoa),
    moeda: texto(body?.moeda) || "BRL",
    imagem_url: texto(body?.imagem_url) || null,
    observacoes: texto(body?.observacoes) || null,
    validade: texto(body?.validade) || null,
    destaque: Boolean(body?.destaque),
  };

  if (createdBy) dados.created_by = createdBy;
  if (tipo !== "pacote") {
    dados.disponibilidade_status = "nao_verificado";
    dados.disponibilidade_falhas = 0;
    dados.disponibilidade_verificada_em = null;
    dados.disponibilidade_motivo = null;
  }

  return dados;
}

export async function GET() {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,status,tipo,titulo,parceiro,link_original,link_afiliado,
      radar_slug,radar_preco_referencia,radar_ida_referencia,radar_volta_referencia,
      origem_codigo,destino_codigo,destino_nome,local_nome,cidade_uf,
      data_ida,data_volta,hotel_nome,hotel_categoria,regime_hospedagem,noites,
      adultos,criancas,companhia_aerea,bagagem,preco_total,impostos_taxas_encargos,
      preco_total_final,preco_por_pessoa,moeda,imagem_url,observacoes,validade,
      destaque,disponibilidade_status,created_at,updated_at
    `)
    .in("status", ["ativo", "rascunho"])
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ sucesso: true, pacotes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const validacao = validar(body);
    if (validacao.erro) return NextResponse.json({ sucesso: false, erro: validacao.erro }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("viagens_pacotes")
      .insert(payload(body, validacao.tipo, user.id))
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, pacote: data }, { status: 201 });
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : "Erro inesperado ao cadastrar oferta." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const id = texto(body?.id);
    if (!id) return NextResponse.json({ sucesso: false, erro: "Oferta invalida para edicao." }, { status: 400 });

    const validacao = validar(body);
    if (validacao.erro) return NextResponse.json({ sucesso: false, erro: validacao.erro }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("viagens_pacotes")
      .update(payload(body, validacao.tipo))
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sucesso: true, pacote: data });
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : "Erro inesperado ao editar oferta." },
      { status: 500 }
    );
  }
}


export async function DELETE(request: NextRequest) {
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.map((id: unknown) => texto(id)).filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { sucesso: false, erro: "Selecione ao menos um pacote para excluir." },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { sucesso: false, erro: "Exclusao limitada a 100 pacotes por vez." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("viagens_pacotes")
      .delete()
      .in("id", ids)
      .eq("tipo", "pacote")
      .select("id,titulo");

    if (error) throw new Error(error.message);

    const excluidos = data ?? [];
    return NextResponse.json({
      sucesso: true,
      excluidos: excluidos.length,
      ids: excluidos.map((item) => item.id),
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado ao excluir pacotes.",
      },
      { status: 500 }
    );
  }
}
