import { supabaseAdmin } from "@/lib/supabase/admin";

const ORIGEM = "mercado_livre_v2";
const STATUS_PRESERVADOS = new Set([
  "aprovado",
  "descartado",
  "publicado",
]);

type CupomMlV2 = Record<string, any>;

type CandidatoExistente = {
  id: string;
  campanha_externa_id: string | null;
  status: string | null;
  aprovado_em: string | null;
  publicado_em: string | null;
  cupom_publicado_id: string | null;
};

export async function persistirCandidatosMlV2(cupons: CupomMlV2[]) {
  const agora = new Date().toISOString();
  const campanhas = cupons
    .map((cupom) => String(cupom.campanha_id || "").trim())
    .filter(Boolean);

  if (campanhas.length === 0) {
    return new Map<string, CandidatoExistente>();
  }

  const { data: existentes, error: erroExistentes } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select(
      "id,campanha_externa_id,status,aprovado_em,publicado_em,cupom_publicado_id"
    )
    .eq("origem", ORIGEM)
    .in("campanha_externa_id", campanhas);

  if (erroExistentes) {
    throw new Error(
      `Falha lendo candidatos ML V2 existentes: ${erroExistentes.message}`
    );
  }

  const existentesPorCampanha = new Map(
    (existentes || []).map((item) => [
      String(item.campanha_externa_id || ""),
      item as CandidatoExistente,
    ])
  );

  const linhas = cupons
    .map((cupom) => {
      const campanhaId = String(cupom.campanha_id || "").trim();
      if (!campanhaId) return null;

      const existente = existentesPorCampanha.get(campanhaId);
      const statusExistente = String(existente?.status || "");
      const status = STATUS_PRESERVADOS.has(statusExistente)
        ? statusExistente
        : "coletado";

      return {
        origem: ORIGEM,
        campanha_externa_id: campanhaId,
        titulo: cupom.titulo || null,
        tipo_desconto: "valor_fixo",
        valor_desconto: Number(cupom.valor_desconto || 0) || null,
        validade: cupom.validade || null,
        status,
        dados_brutos: cupom,
        top_produtos: Array.isArray(cupom.produtos) ? cupom.produtos : [],
        resumo_produtos: {
          quantidade: Array.isArray(cupom.produtos) ? cupom.produtos.length : 0,
          escopo: cupom.escopo || null,
          uso_ml: cupom.acao || null,
          tipo_acao: cupom.tipo_acao || null,
        },
        motivos: [
          "ml_v2_created_by_meli",
          "ml_v2_valor_fixo",
          cupom.escopo === "produtos_selecionados"
            ? "ml_v2_produtos_selecionados"
            : "ml_v2_site_inteiro",
        ],
        ultima_coleta_em: agora,
        analisado_em:
          status === "aprovado" || status === "descartado" || status === "publicado"
            ? agora
            : null,
        aprovado_em:
          status === "aprovado" || status === "publicado"
            ? existente?.aprovado_em || agora
            : null,
        publicado_em:
          status === "publicado" ? existente?.publicado_em || agora : null,
        cupom_publicado_id:
          status === "publicado" ? existente?.cupom_publicado_id || null : null,
        updated_at: agora,
      };
    })
    .filter(Boolean);

  const { data: gravados, error: erroGravacao } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .upsert(linhas, {
      onConflict: "origem,campanha_externa_id",
      ignoreDuplicates: false,
      defaultToNull: false,
    })
    .select(
      "id,campanha_externa_id,status,aprovado_em,publicado_em,cupom_publicado_id"
    );

  if (erroGravacao) {
    throw new Error(
      `Falha persistindo candidatos ML V2: ${erroGravacao.message}`
    );
  }

  return new Map(
    (gravados || []).map((item) => [
      String(item.campanha_externa_id || ""),
      item as CandidatoExistente,
    ])
  );
}
