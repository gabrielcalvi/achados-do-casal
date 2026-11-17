import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const produtoId = Number(body.produtoId);
    const titulo = String(body.titulo || "").trim().slice(0, 160);
    const texto = String(body.texto || "").trim().slice(0, 3000);
    const notaRaw = body.nota;
    const nota = notaRaw === "" || notaRaw == null ? null : Number(notaRaw);
    const tempoDeUso = String(body.tempoDeUso || "").trim().slice(0, 120);
    const dataReferencia = String(body.dataReferencia || "").trim();

    if (!Number.isInteger(produtoId) || produtoId <= 0 || !titulo || !texto) {
      return Response.json({ erro: "Dados incompletos." }, { status: 400 });
    }
    if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > 10)) {
      return Response.json({ erro: "Nota inválida." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("review_atualizacoes").insert({
      produto_id: produtoId,
      titulo,
      texto,
      nota,
      tempo_de_uso: tempoDeUso || null,
      data_referencia: dataReferencia || new Date().toISOString().slice(0,10),
      visivel: true,
    });

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (erro) {
    console.error("Falha ao salvar atualização de review:", erro);
    return Response.json({ erro: "Não foi possível salvar a atualização." }, { status: 500 });
  }
}
