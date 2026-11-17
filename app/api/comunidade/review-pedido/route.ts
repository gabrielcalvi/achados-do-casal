import { supabaseAdmin } from "@/lib/supabase/admin";

function urlValida(valor: string) {
  if (!valor) return true;
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const produtoId = Number(body.produtoId);
    const urlProduto = String(body.urlProduto || "").trim().slice(0, 1200);
    const nomeProduto = String(body.nomeProduto || "").trim().slice(0, 200);
    const mensagem = String(body.mensagem || "").trim().slice(0, 500);
    const sessionId = String(body.sessionId || "").trim().slice(0, 120);
    const honeypot = String(body.empresa || "").trim();

    if (honeypot) return Response.json({ ok: true });
    if (!sessionId) {
      return Response.json({ erro: "Sessão inválida." }, { status: 400 });
    }
    if (!Number.isInteger(produtoId) && !urlProduto && !nomeProduto) {
      return Response.json({ erro: "Informe um produto ou link." }, { status: 400 });
    }
    if (!urlValida(urlProduto)) {
      return Response.json({ erro: "Link inválido." }, { status: 400 });
    }

    if (Number.isInteger(produtoId) && produtoId > 0) {
      const { data: existente } = await supabaseAdmin
        .from("produto_solicitacoes_review")
        .select("id")
        .eq("produto_id", produtoId)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existente) return Response.json({ ok: true, duplicado: true });
    }

    const { error } = await supabaseAdmin.from("produto_solicitacoes_review").insert({
      produto_id: Number.isInteger(produtoId) && produtoId > 0 ? produtoId : null,
      url_produto: urlProduto || null,
      nome_produto: nomeProduto || null,
      mensagem: mensagem || null,
      session_id: sessionId,
      status: "novo",
    });

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (erro) {
    console.error("Falha ao registrar pedido de review:", erro);
    return Response.json({ erro: "Não foi possível registrar o pedido." }, { status: 500 });
  }
}
