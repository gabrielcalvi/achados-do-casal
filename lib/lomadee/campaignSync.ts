import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  gerarDeeplinkLomadee,
  listarCampanhasLomadeeAtivas,
  listarMarcasLomadee,
  type LomadeeBrand,
  type LomadeeCampaign,
} from "@/lib/lomadee/api";

const ORIGEM = "lomadee_api";
const ORIGEM_RADAR = "black_friday_radar_2026";

function normalizar(valor: string | null | undefined) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slugify(valor: string) {
  return (
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " e ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "marca-lomadee"
  );
}

function urlValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !valor.trim()) return false;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function dominio(site?: string) {
  if (!site) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function beneficio(campanha: LomadeeCampaign) {
  const texto = [campanha.name, campanha.description, ...(campanha.categories || [])]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");

  if (/frete\s+gr[aá]tis/i.test(texto)) {
    return { tipo: "frete_gratis" as const, percentual: null, valor: null, bom: true };
  }

  const ps = Array.from(
    texto.matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*%/g),
    (m) => Number(m[1].replace(",", ".")),
  ).filter((v) => Number.isFinite(v) && v > 0 && v <= 90);
  if (ps.length) {
    const percentual = Math.min(...ps);
    return { tipo: "percentual" as const, percentual, valor: null, bom: percentual >= 10 };
  }

  const vs = Array.from(
    texto.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi),
    (m) => Number(m[1].replace(/\./g, "").replace(",", ".")),
  ).filter((v) => Number.isFinite(v) && v > 0);
  if (vs.length) {
    const valor = Math.min(...vs);
    return { tipo: "valor_fixo" as const, percentual: null, valor, bom: valor >= 20 };
  }

  return { tipo: "outro" as const, percentual: null, valor: null, bom: false };
}

function linkDaCampanha(campanha: LomadeeCampaign) {
  const canais = campanha.channels || [];
  const preferido =
    canais.find((c) =>
      /achados\s*do\s*casal|achadosdocasal/i.test(
        `${c.name || ""} ${c.availableChannel?.name || ""}`,
      ),
    ) ||
    canais.find((c) => !c.message) ||
    canais[0];

  return (
    preferido?.shortUrls?.find(urlValida) ||
    canais.flatMap((c) => c.shortUrls || []).find(urlValida) ||
    null
  );
}

async function garantirLoja(
  marca: LomadeeBrand,
  lojas: Array<{ id: string; nome: string; slug: string; dominio: string | null }>,
) {
  const dom = dominio(marca.site);
  const existente = lojas.find(
    (l) =>
      normalizar(l.nome) === normalizar(marca.name) ||
      (dom && l.dominio && l.dominio.toLowerCase().replace(/^www\./, "") === dom),
  );
  if (existente) return existente;

  const base = slugify(marca.slug || marca.name);
  let slug = base;
  let n = 2;
  while (lojas.some((l) => l.slug === slug)) slug = `${base}-${n++}`;

  const { data, error } = await supabaseAdmin
    .from("economize_lojas")
    .insert({
      nome: marca.name,
      slug,
      dominio: dom,
      ativa: true,
      ordem: 900,
      segmento: "varejo",
    })
    .select("id,nome,slug,dominio")
    .single();

  if (error || !data) throw new Error(error?.message || "Falha ao criar loja Lomadee.");
  lojas.push(data);
  return data;
}

async function awinPrincipal(lojaId: string) {
  const { data, error } = await supabaseAdmin
    .from("economize_fontes")
    .select("nome,configuracao")
    .eq("loja_id", lojaId)
    .eq("ativa", true);
  if (error) throw new Error(error.message);

  return (data || []).some((f) => {
    const cfg = (f.configuracao || {}) as Record<string, unknown>;
    const provedor = String(cfg.provedor || "").toLowerCase();
    return (
      (provedor === "awin" || /awin/i.test(String(f.nome || ""))) &&
      cfg.monitor_only !== true
    );
  });
}

async function garantirFonteLomadee(lojaId: string, organizationId: string) {
  const url = `lomadee://campaigns/${organizationId}`;
  const payload = {
    loja_id: lojaId,
    nome: "Lomadee - cupons e campanhas",
    tipo: "afiliado",
    url,
    ativa: true,
    prioridade: 20,
    intervalo_minutos: 180,
    configuracao: {
      provedor: "lomadee",
      finalidade: "cupons_campanhas",
      organization_id: organizationId,
      exigir_link_afiliado: true,
      fonte_principal: true,
    },
    updated_at: new Date().toISOString(),
  };

  const { data: existente, error } = await supabaseAdmin
    .from("economize_fontes")
    .select("id")
    .eq("loja_id", lojaId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (existente?.id) {
    const { error: e } = await supabaseAdmin.from("economize_fontes").update(payload).eq("id", existente.id);
    if (e) throw new Error(e.message);
  } else {
    const { error: e } = await supabaseAdmin.from("economize_fontes").insert(payload);
    if (e) throw new Error(e.message);
  }
}

async function desativarRadar(lojaId: string) {
  const agora = new Date().toISOString();
  await Promise.all([
    supabaseAdmin
      .from("economize_cupons")
      .update({ status: "inativo", updated_at: agora })
      .eq("loja_id", lojaId)
      .eq("origem", ORIGEM_RADAR)
      .in("status", ["ativo", "pendente"]),
    supabaseAdmin
      .from("economize_ofertas")
      .update({ status: "inativo", updated_at: agora })
      .eq("loja_id", lojaId)
      .eq("origem", ORIGEM_RADAR)
      .in("status", ["ativo", "pendente"]),
  ]);
}

async function salvar(
  campanha: LomadeeCampaign,
  marca: LomadeeBrand,
  loja: { id: string; nome: string; slug: string; dominio: string | null },
) {
  if (campanha.status !== "onTime") return { salvo: false, motivo: "fora_do_periodo" };
  const b = beneficio(campanha);
  if (!b.bom) return { salvo: false, motivo: "beneficio_baixo_ou_indefinido" };

  const codigo = campanha.code?.trim() || null;
  if (campanha.type !== "Offer" && (!codigo || !/^[A-Z0-9][A-Z0-9_-]{2,39}$/i.test(codigo))) {
    return { salvo: false, motivo: "codigo_invalido" };
  }

  let linkAfiliado = linkDaCampanha(campanha);
  if (!linkAfiliado && urlValida(campanha.url)) {
    try {
      linkAfiliado = await gerarDeeplinkLomadee(
        campanha.url,
        campanha.organizationId,
        `cupom-${campanha.id}`,
        campanha.offerType === "Spreadsheet" ? campanha.id : undefined,
      );
    } catch {
      linkAfiliado = null;
    }
  }
  if (!linkAfiliado) return { salvo: false, motivo: "sem_link_afiliado" };

  if (codigo) {
    const { data: duplicado, error } = await supabaseAdmin
      .from("economize_cupons")
      .select("id")
      .eq("loja_id", loja.id)
      .eq("codigo", codigo)
      .eq("status", "ativo")
      .neq("origem", ORIGEM)
      .neq("origem", ORIGEM_RADAR)
      .limit(1);
    if (error) throw new Error(error.message);
    if (duplicado?.length) return { salvo: false, motivo: "outra_fonte_ja_resolve" };
  }

  const agora = new Date().toISOString();
  const dedupe = `lomadee:${campanha.id}`;
  const titulo = campanha.name?.trim() || `Campanha ${marca.name}`;
  const descricao = campanha.description?.trim() || `Campanha ${marca.name} via Lomadee.`;
  const dados = {
    provider: "lomadee",
    campaign_id: campanha.id,
    organization_id: campanha.organizationId,
    affiliate_url: linkAfiliado,
    quality_rule: "onTime+monetizada+beneficio_relevante",
  };

  const cupomPayload = {
    loja_id: loja.id,
    status: "ativo",
    codigo,
    titulo,
    descricao,
    regras: "Campanha recebida pela Affiliate API da Lomadee. Confira as condições finais no carrinho.",
    tipo_desconto: b.tipo,
    desconto_percentual: b.percentual,
    valor_desconto: b.valor,
    data_inicio: campanha.period?.startAt || null,
    validade: campanha.period?.endAt || null,
    link_destino: urlValida(campanha.url) ? campanha.url : linkAfiliado,
    link_afiliado: linkAfiliado,
    origem: ORIGEM,
    origem_url: "https://api.lomadee.com.br/affiliate/campaigns",
    dedupe_key: dedupe,
    dados_brutos: dados,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  const { data: atual, error: erroBusca } = await supabaseAdmin
    .from("economize_cupons")
    .select("id")
    .eq("loja_id", loja.id)
    .eq("dedupe_key", dedupe)
    .maybeSingle();
  if (erroBusca) throw new Error(erroBusca.message);

  let cupomId: string;
  let novo = false;
  if (atual?.id) {
    const { data, error } = await supabaseAdmin
      .from("economize_cupons")
      .update(cupomPayload)
      .eq("id", atual.id)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao atualizar cupom.");
    cupomId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("economize_cupons")
      .insert(cupomPayload)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Falha ao inserir cupom.");
    cupomId = data.id;
    novo = true;
  }

  const ofertaPayload = {
    loja_id: loja.id,
    tipo: campanha.type === "Offer" ? "campanha" : "cupom",
    status: "ativo",
    titulo,
    descricao,
    codigo,
    categoria: "Cupons",
    regras: "Confira as condições finais no carrinho da loja.",
    imagem_url: campanha.mediaKit?.banners?.find(urlValida) || null,
    link_destino: urlValida(campanha.url) ? campanha.url : linkAfiliado,
    link_afiliado: linkAfiliado,
    desconto_percentual: b.percentual,
    valor_desconto: b.valor,
    data_inicio: campanha.period?.startAt || null,
    validade: campanha.period?.endAt || null,
    destaque: Boolean(campanha.isHighlight) || (b.percentual || 0) >= 20 || (b.valor || 0) >= 50,
    selos: ["LOMADEE", "AFILIADO", "VERIFICADO"],
    origem: ORIGEM,
    origem_url: "https://api.lomadee.com.br/affiliate/campaigns",
    dedupe_key: dedupe,
    dados_brutos: dados,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  const { data: ofertaAtual, error: erroOferta } = await supabaseAdmin
    .from("economize_ofertas")
    .select("id")
    .eq("loja_id", loja.id)
    .eq("dedupe_key", dedupe)
    .maybeSingle();
  if (erroOferta) throw new Error(erroOferta.message);

  let ofertaId: string;
  if (ofertaAtual?.id) {
    const { data, error } = await supabaseAdmin.from("economize_ofertas").update(ofertaPayload).eq("id", ofertaAtual.id).select("id").single();
    if (error || !data) throw new Error(error?.message || "Falha ao atualizar oferta.");
    ofertaId = data.id;
  } else {
    const { data, error } = await supabaseAdmin.from("economize_ofertas").insert(ofertaPayload).select("id").single();
    if (error || !data) throw new Error(error?.message || "Falha ao inserir oferta.");
    ofertaId = data.id;
  }

  const { error: erroVinculo } = await supabaseAdmin
    .from("economize_cupons_ofertas")
    .upsert(
      { cupom_id: cupomId, oferta_id: ofertaId, aplicacao: "possivel", observacao: "Lomadee Affiliate API" },
      { onConflict: "cupom_id,oferta_id" },
    );
  if (erroVinculo && erroVinculo.code !== "23505") throw new Error(erroVinculo.message);

  return { salvo: true, novo, dedupe };
}

export async function sincronizarCampanhasLomadee() {
  const [marcas, campanhas, lojasResp] = await Promise.all([
    listarMarcasLomadee(),
    listarCampanhasLomadeeAtivas(),
    supabaseAdmin.from("economize_lojas").select("id,nome,slug,dominio").eq("ativa", true),
  ]);
  if (lojasResp.error) throw new Error(lojasResp.error.message);

  const lojas = lojasResp.data || [];
  const marcasPorId = new Map(marcas.map((m) => [m.id, m]));
  const grupos = new Map<string, LomadeeCampaign[]>();
  for (const c of campanhas) {
    if (!c.organizationId) continue;
    const g = grupos.get(c.organizationId) || [];
    g.push(c);
    grupos.set(c.organizationId, g);
  }

  let publicadas = 0;
  let novas = 0;
  let rejeitadas = 0;
  let lojasAwin = 0;
  let lojasLomadee = 0;
  let erros = 0;
  const dedupesAtivos = new Set<string>();

  for (const [organizationId, lista] of grupos) {
    const marca = marcasPorId.get(organizationId);
    // Importação inicial controlada: somente TeraByte foi aprovada para
    // operação Lomadee. Outras marcas exigem curadoria explícita para evitar
    // transformar as 133 marcas acessíveis em um catálogo indiscriminado.
    if (!marca || normalizar(marca.name) !== "terabyte") continue;

    try {
      const loja = await garantirLoja(marca, lojas);
      if (await awinPrincipal(loja.id)) {
        lojasAwin += 1;
        continue;
      }

      let salvas = 0;
      for (const campanha of lista) {
        try {
          const r = await salvar(campanha, marca, loja);
          if (r.salvo && r.dedupe) {
            publicadas += 1;
            salvas += 1;
            dedupesAtivos.add(r.dedupe);
            if (r.novo) novas += 1;
          } else {
            rejeitadas += 1;
          }
        } catch {
          erros += 1;
        }
      }

      if (salvas > 0) {
        await garantirFonteLomadee(loja.id, organizationId);
        await desativarRadar(loja.id);
        lojasLomadee += 1;
      }
    } catch {
      erros += 1;
    }
  }

  const { data: antigos, error } = await supabaseAdmin
    .from("economize_cupons")
    .select("id,dedupe_key")
    .eq("origem", ORIGEM)
    .in("status", ["ativo", "pendente"]);
  if (error) throw new Error(error.message);

  const obsoletos = (antigos || []).filter(
    (x) => x.dedupe_key && !dedupesAtivos.has(x.dedupe_key),
  );
  const ids = obsoletos.map((x) => x.id);
  const keys = obsoletos.map((x) => x.dedupe_key).filter(Boolean) as string[];
  if (ids.length) {
    const agora = new Date().toISOString();
    await Promise.all([
      supabaseAdmin.from("economize_cupons").update({ status: "inativo", updated_at: agora }).in("id", ids),
      supabaseAdmin.from("economize_ofertas").update({ status: "inativo", updated_at: agora }).eq("origem", ORIGEM).in("dedupe_key", keys),
    ]);
  }

  return {
    sucesso: true,
    executado_em: new Date().toISOString(),
    resumo: {
      marcas_acessiveis: marcas.length,
      campanhas_recebidas: campanhas.length,
      campanhas_publicadas: publicadas,
      campanhas_novas: novas,
      campanhas_rejeitadas: rejeitadas,
      lojas_ignoradas_awin: lojasAwin,
      lojas_lomadee_principal: lojasLomadee,
      lomadee_desativados: ids.length,
      erros,
    },
  };
}
