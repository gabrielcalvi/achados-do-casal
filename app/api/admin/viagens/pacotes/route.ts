import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function usuarioAtual() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numero(valor: unknown) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
}

function urlValida(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function tabelaNaoExiste(erro: any) {
  const mensagem = String(erro?.message || "").toLowerCase();
  const codigo = String(erro?.code || "");

  return (
    codigo === "42P01" ||
    codigo === "PGRST205" ||
    mensagem.includes("viagens_pacotes") &&
      (mensagem.includes("does not exist") ||
        mensagem.includes("schema cache"))
  );
}

export async function GET() {
  const user = await usuarioAtual();

  if (!user) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select(`
      id,
      status,
      titulo,
      parceiro,
      link_original,
      link_afiliado,
      radar_slug,
      radar_preco_referencia,
      radar_ida_referencia,
      radar_volta_referencia,
      origem_codigo,
      destino_codigo,
      destino_nome,
      data_ida,
      data_volta,
      hotel_nome,
      hotel_categoria,
      regime_hospedagem,
      noites,
      adultos,
      criancas,
      companhia_aerea,
      bagagem,
      preco_total,
      preco_por_pessoa,
      moeda,
      imagem_url,
      observacoes,
      validade,
      destaque,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (tabelaNaoExiste(error)) {
      return NextResponse.json({
        sucesso: true,
        schema_pendente: true,
        pacotes: [],
        aviso:
          "A migration viagens_pacotes ainda precisa ser aplicada no Supabase.",
      });
    }

    console.error("[Pacotes viagem] Falha ao listar:", error);

    return NextResponse.json(
      { sucesso: false, erro: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    schema_pendente: false,
    pacotes: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const user = await usuarioAtual();

  if (!user) {
    return NextResponse.json(
      { sucesso: false, erro: "Nao autorizado." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const titulo = texto(body?.titulo);
    const parceiro = texto(body?.parceiro) || "Decolar";
    const linkOriginal = texto(body?.link_original);
    const linkAfiliado = texto(body?.link_afiliado);
    const origem = texto(body?.origem_codigo).toUpperCase();
    const destino = texto(body?.destino_codigo).toUpperCase();
    const dataIda = texto(body?.data_ida);
    const dataVolta = texto(body?.data_volta);
    const hotel = texto(body?.hotel_nome);
    const noites = numero(body?.noites);
    const adultos = numero(body?.adultos) ?? 2;
    const criancas = numero(body?.criancas) ?? 0;
    const precoTotal = numero(body?.preco_total);
    const precoPorPessoa = numero(body?.preco_por_pessoa);

    if (!titulo) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe o titulo do pacote." },
        { status: 400 }
      );
    }

    if (linkOriginal && !urlValida(linkOriginal)) {
      return NextResponse.json(
        { sucesso: false, erro: "O link original da Decolar e invalido." },
        { status: 400 }
      );
    }

    if (!linkAfiliado || !urlValida(linkAfiliado)) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe um link afiliado valido." },
        { status: 400 }
      );
    }

    if (!origem || !destino) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe origem e destino." },
        { status: 400 }
      );
    }

    if (!dataIda || !dataVolta || dataVolta < dataIda) {
      return NextResponse.json(
        { sucesso: false, erro: "Confira as datas de ida e volta." },
        { status: 400 }
      );
    }

    if (!hotel) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe o hotel." },
        { status: 400 }
      );
    }

    if (!noites || noites <= 0) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe a quantidade de noites." },
        { status: 400 }
      );
    }

    if (!precoTotal || precoTotal <= 0) {
      return NextResponse.json(
        { sucesso: false, erro: "Informe o preco total do pacote." },
        { status: 400 }
      );
    }

    const imagemUrl = texto(body?.imagem_url);

    if (imagemUrl && !urlValida(imagemUrl)) {
      return NextResponse.json(
        { sucesso: false, erro: "A URL da imagem e invalida." },
        { status: 400 }
      );
    }

    const payload = {
      status: texto(body?.status) || "rascunho",
      titulo,
      parceiro,
      link_original: linkOriginal || null,
      link_afiliado: linkAfiliado,
      radar_slug: texto(body?.radar_slug) || null,
      radar_preco_referencia: numero(body?.radar_preco_referencia),
      radar_ida_referencia: texto(body?.radar_ida_referencia) || null,
      radar_volta_referencia: texto(body?.radar_volta_referencia) || null,
      origem_codigo: origem,
      destino_codigo: destino,
      destino_nome: texto(body?.destino_nome) || null,
      data_ida: dataIda,
      data_volta: dataVolta,
      hotel_nome: hotel,
      hotel_categoria: texto(body?.hotel_categoria) || null,
      regime_hospedagem: texto(body?.regime_hospedagem) || null,
      noites,
      adultos,
      criancas,
      companhia_aerea: texto(body?.companhia_aerea) || null,
      bagagem: texto(body?.bagagem) || null,
      preco_total: precoTotal,
      preco_por_pessoa: precoPorPessoa,
      moeda: texto(body?.moeda) || "BRL",
      imagem_url: imagemUrl || null,
      observacoes: texto(body?.observacoes) || null,
      validade: texto(body?.validade) || null,
      destaque: Boolean(body?.destaque),
      created_by: user.id,
    };

    const { data, error } = await supabaseAdmin
      .from("viagens_pacotes")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (tabelaNaoExiste(error)) {
        return NextResponse.json(
          {
            sucesso: false,
            schema_pendente: true,
            erro:
              "A base de Pacotes de Viagem ainda precisa ser aplicada no Supabase.",
          },
          { status: 503 }
        );
      }

      throw new Error(error.message);
    }

    return NextResponse.json(
      { sucesso: true, pacote: data },
      { status: 201 }
    );
  } catch (erro) {
    console.error("[Pacotes viagem] Falha ao cadastrar:", erro);

    return NextResponse.json(
      {
        sucesso: false,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado ao cadastrar pacote.",
      },
      { status: 500 }
    );
  }
}
