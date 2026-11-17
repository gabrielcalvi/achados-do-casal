import { supabaseAdmin } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const produtoId = Number(body.produtoId);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const precoAlvoRaw = body.precoAlvo;
    const precoAlvo = precoAlvoRaw === null || precoAlvoRaw === undefined || precoAlvoRaw === ""
      ? null
      : Number(precoAlvoRaw);

    if (!Number.isInteger(produtoId) || produtoId <= 0 || !EMAIL.test(email)) {
      return Response.json({ erro: "Dados inválidos." }, { status: 400 });
    }
    if (precoAlvo !== null && (!Number.isFinite(precoAlvo) || precoAlvo <= 0)) {
      return Response.json({ erro: "Preço alvo inválido." }, { status: 400 });
    }

    const { data: produto, error: erroProduto } = await supabaseAdmin
      .from("produtos")
      .select("id,nome,ativo,preco_atual")
      .eq("id", produtoId)
      .maybeSingle();

    const precoAtual = Number(produto?.preco_atual);
    if (erroProduto || !produto || !produto.ativo || !Number.isFinite(precoAtual) || precoAtual <= 0) {
      return Response.json({ erro: "Produto sem preço monitorável." }, { status: 409 });
    }

    const { data: existente } = await supabaseAdmin
      .from("produto_alertas_preco")
      .select("id")
      .eq("produto_id", produtoId)
      .in("status", ["ativo", "atingido"])
      .ilike("email", email)
      .maybeSingle();

    const dados = {
      email,
      preco_referencia: precoAtual,
      preco_alvo: precoAlvo,
      ultimo_preco: precoAtual,
      status: "ativo",
      atingido_em: null,
      notificado_em: null,
      atualizado_em: new Date().toISOString(),
    };

    const resultado = existente
      ? await supabaseAdmin.from("produto_alertas_preco").update(dados).eq("id", existente.id)
      : await supabaseAdmin.from("produto_alertas_preco").insert({ produto_id: produtoId, ...dados });

    if (resultado.error) throw resultado.error;
    return Response.json({ ok: true, precoReferencia: precoAtual });
  } catch (erro) {
    console.error("Falha ao cadastrar alerta de preço:", erro);
    return Response.json({ erro: "Não foi possível cadastrar o alerta." }, { status: 500 });
  }
}
