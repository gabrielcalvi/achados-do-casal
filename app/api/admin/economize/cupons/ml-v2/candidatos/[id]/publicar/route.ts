import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = {
  params: Promise<{ id: string }>;
};

type CorpoPublicacao = {
  item_id?: string;
  link_destino?: string;
  link_afiliado?: string;
  codigo_publico?: string;
  validado_comprador?: boolean;
  confirmar_link_proprio?: boolean;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function numeroOuNull(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function urlValida(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function ehMercadoLivre(url: URL) {
  const host = url.hostname.toLowerCase();
  return (
    host.endsWith("mercadolivre.com.br") ||
    host.endsWith("mercadolivre.com") ||
    host.endsWith("mercadolibre.com")
  );
}

function ehLinkAfiliadoMl(url: URL) {
  const host = url.hostname.toLowerCase();
  return host === "meli.la" || host.endsWith(".meli.la");
}

function caminhoNormalizado(url: URL) {
  return url.pathname.replace(/\/+$/, "").toLowerCase();
}

function urlContemItem(url: URL, itemId: string) {
  const alvo = itemId.toUpperCase();
  const partes = [url.pathname, url.search, url.hash]
    .map((parte) => {
      try {
        return decodeURIComponent(parte);
      } catch {
        return parte;
      }
    })
    .join(" ")
    .toUpperCase();

  return partes.includes(alvo);
}

async function resolverDestinoMercadoLivre(url: string) {
  const resposta = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
    },
  });

  const final = new URL(resposta.url);
  if (!ehMercadoLivre(final)) {
    throw new Error("O redirecionamento não terminou no Mercado Livre.");
  }

  return final;
}

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

async function validarDestinoDoLinkAfiliado(
  linkAfiliado: string,
  linkDestino: string,
  itemId: string
) {
  try {
    const finalAfiliado = await resolverDestinoMercadoLivre(linkAfiliado);
    const urlFinalAfiliado = finalAfiliado.toString();

    if (urlContemItem(finalAfiliado, itemId)) {
      return {
        ok: true as const,
        url_final: urlFinalAfiliado,
        modo_validacao: "item_id_na_url_final",
      };
    }

    let finalDestino: URL | null = null;
    try {
      finalDestino = await resolverDestinoMercadoLivre(linkDestino);
    } catch {
      finalDestino = null;
    }

    if (
      finalDestino &&
      finalDestino.hostname.toLowerCase() === finalAfiliado.hostname.toLowerCase() &&
      caminhoNormalizado(finalDestino) === caminhoNormalizado(finalAfiliado)
    ) {
      return {
        ok: true as const,
        url_final: urlFinalAfiliado,
        url_destino_final: finalDestino.toString(),
        modo_validacao: "mesmo_destino_canonico",
      };
    }

    return {
      ok: false as const,
      erro:
        "A validação automática do Mercado Livre não conseguiu comparar o destino final do meli.la com a URL original.",
      diagnostico: {
        item_id: itemId,
        afiliado_final: urlFinalAfiliado,
        destino_final: finalDestino?.toString() || null,
      },
    };
  } catch (erro) {
    return {
      ok: false as const,
      erro:
        erro instanceof Error
          ? `A validação automática do meli.la não foi conclusiva: ${erro.message}`
          : "A validação automática do meli.la não foi conclusiva.",
      diagnostico: null,
    };
  }
}

export async function POST(
  request: Request,
  contexto: ContextoRota
) {
  if (!(await usuarioAutenticado())) {
    return NextResponse.json(
      { sucesso: false, erro: "Não autorizado." },
      { status: 401 }
    );
  }

  const { id } = await contexto.params;
  const body = (await request.json().catch(() => null)) as
    | CorpoPublicacao
    | null;

  const itemId = texto(body?.item_id).toUpperCase();
  const linkDestino = texto(body?.link_destino);
  const linkAfiliado = texto(body?.link_afiliado);
  const codigoPublico = texto(body?.codigo_publico).toUpperCase();

  if (
    !itemId ||
    !linkDestino ||
    !linkAfiliado ||
    !codigoPublico ||
    body?.validado_comprador !== true ||
    body?.confirmar_link_proprio !== true
  ) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          "Publicação bloqueada: item, link de destino, link afiliado, código público e confirmações de validação são obrigatórios.",
      },
      { status: 400 }
    );
  }

  const destino = urlValida(linkDestino);
  const afiliado = urlValida(linkAfiliado);

  if (!destino || !ehMercadoLivre(destino)) {
    return NextResponse.json(
      { sucesso: false, erro: "Link de destino inválido para Mercado Livre." },
      { status: 400 }
    );
  }

  if (!afiliado || !ehLinkAfiliadoMl(afiliado)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          "Link afiliado inválido. No ML V2 aceitamos somente link curto meli.la gerado na conta afiliada.",
      },
      { status: 400 }
    );
  }

  const { data: candidato, error: erroCandidato } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .select(
      "id,origem,campanha_externa_id,titulo,tipo_desconto,valor_desconto,validade,status,dados_brutos,top_produtos"
    )
    .eq("id", id)
    .single();

  if (erroCandidato || !candidato) {
    return NextResponse.json(
      { sucesso: false, erro: "Candidato não encontrado." },
      { status: 404 }
    );
  }

  if (candidato.origem !== "mercado_livre_v2") {
    return NextResponse.json(
      { sucesso: false, erro: "Este candidato não pertence ao ML V2." },
      { status: 400 }
    );
  }

  if (candidato.status === "publicado") {
    return NextResponse.json(
      { sucesso: true, ja_publicado: true, cupom_id: candidato.id },
      { status: 200 }
    );
  }

  if (candidato.status !== "aprovado") {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O candidato precisa estar aprovado antes da publicação.",
      },
      { status: 409 }
    );
  }

  const bruto = (candidato.dados_brutos || {}) as Record<string, any>;
  const itemIds = Array.isArray(bruto.item_ids)
    ? bruto.item_ids.map((valor: unknown) => texto(valor).toUpperCase())
    : [];

  if (!itemIds.includes(itemId)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O item selecionado não pertence a este cupom oficial.",
      },
      { status: 400 }
    );
  }

  if (
    bruto.criado_por !== "meli" ||
    bruto.tipo_original !== "FIXED" ||
    bruto.regra_simples !== true
  ) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "O candidato não atende mais às regras fechadas do ML V2.",
      },
      { status: 409 }
    );
  }

  const validade = candidato.validade
    ? new Date(candidato.validade).getTime()
    : null;

  if (validade !== null && (!Number.isFinite(validade) || validade <= Date.now())) {
    return NextResponse.json(
      { sucesso: false, erro: "O candidato está expirado." },
      { status: 409 }
    );
  }

  const validacaoAutomatica = await validarDestinoDoLinkAfiliado(
    linkAfiliado,
    linkDestino,
    itemId
  );

  const validacaoAfiliado = validacaoAutomatica.ok
    ? validacaoAutomatica
    : {
        ok: true as const,
        url_final:
          validacaoAutomatica.diagnostico?.afiliado_final || linkAfiliado,
        url_destino_final:
          validacaoAutomatica.diagnostico?.destino_final || null,
        modo_validacao: "confirmacao_manual_admin",
        aviso_validacao_automatica: validacaoAutomatica.erro,
      };

  if (!validacaoAutomatica.ok) {
    console.warn("[ML V2] Validação automática inconclusiva; usando confirmação manual do admin.", {
      candidato_id: candidato.id,
      item_id: itemId,
      diagnostico: validacaoAutomatica.diagnostico || null,
    });
  }

  const { data: loja, error: erroLoja } = await supabaseAdmin
    .from("economize_lojas")
    .select("id")
    .eq("slug", "mercado-livre")
    .eq("ativa", true)
    .single();

  if (erroLoja || !loja) {
    return NextResponse.json(
      { sucesso: false, erro: "Loja Mercado Livre não encontrada." },
      { status: 500 }
    );
  }

  const indiceItem = itemIds.indexOf(itemId);
  const produtos = Array.isArray(candidato.top_produtos)
    ? candidato.top_produtos
    : [];
  const produto = produtos[indiceItem] || {};

  const agora = new Date().toISOString();
  const campanha = texto(candidato.campanha_externa_id);
  const titulo = texto(candidato.titulo) || `Cupom Mercado Livre ${campanha}`;
  const valorDesconto = numeroOuNull(candidato.valor_desconto);
  const pedidoMinimo = numeroOuNull(bruto.compra_minima);
  const limiteDesconto = numeroOuNull(bruto.limite_desconto);
  const origem = "mercado_livre_v2";
  const dedupeCupom = `ml-v2:${campanha}`;
  const dedupeOferta = `ml-v2:${campanha}:${itemId}`;

  const regras = [
    valorDesconto !== null ? `Desconto de R$ ${valorDesconto.toFixed(2)}.` : null,
    pedidoMinimo !== null ? `Compra mínima de R$ ${pedidoMinimo.toFixed(2)}.` : null,
    "Cupom oficial criado pelo Mercado Livre.",
    "Sujeito à elegibilidade, estoque e regras exibidas no checkout.",
  ]
    .filter(Boolean)
    .join(" ");

  const dadosBrutosPublicacao = {
    fonte: origem,
    campanha_id: campanha,
    item_id: itemId,
    validado_comprador: true,
    link_afiliado_confirmado: true,
    link_afiliado_url_final: validacaoAfiliado.url_final,
    link_destino_url_final: validacaoAfiliado.url_destino_final || null,
    link_afiliado_modo_validacao: validacaoAfiliado.modo_validacao,
    aviso_validacao_automatica:
      "aviso_validacao_automatica" in validacaoAfiliado
        ? validacaoAfiliado.aviso_validacao_automatica
        : null,
    candidato: bruto,
  };

  const { data: ofertaExistente } = await supabaseAdmin
    .from("economize_ofertas")
    .select("id")
    .eq("dedupe_key", dedupeOferta)
    .maybeSingle();

  let ofertaId = ofertaExistente?.id as string | undefined;

  const ofertaDados = {
    loja_id: loja.id,
    tipo: "cupom",
    status: "ativo",
    titulo,
    descricao: texto(produto?.nome) || titulo,
    codigo: codigoPublico,
    categoria: null,
    regras,
    imagem_url: texto(produto?.imagem) || null,
    link_destino: linkDestino,
    link_afiliado: linkAfiliado,
    desconto_percentual: null,
    valor_desconto: valorDesconto,
    cashback_percentual: null,
    pedido_minimo: pedidoMinimo,
    preco_original: null,
    preco_oferta: null,
    data_inicio: null,
    validade: candidato.validade,
    destaque: false,
    selos: ["Cupom oficial Mercado Livre"],
    origem,
    origem_url: linkDestino,
    dedupe_key: dedupeOferta,
    dados_brutos: dadosBrutosPublicacao,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  if (ofertaId) {
    const { error } = await supabaseAdmin
      .from("economize_ofertas")
      .update(ofertaDados)
      .eq("id", ofertaId);
    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: `Falha atualizando oferta: ${error.message}` },
        { status: 500 }
      );
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("economize_ofertas")
      .insert(ofertaDados)
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { sucesso: false, erro: `Falha criando oferta: ${error?.message || "sem retorno"}` },
        { status: 500 }
      );
    }
    ofertaId = data.id;
  }

  const { data: cupomExistente } = await supabaseAdmin
    .from("economize_cupons")
    .select("id")
    .eq("dedupe_key", dedupeCupom)
    .maybeSingle();

  const cupomDados = {
    loja_id: loja.id,
    status: "ativo",
    codigo: codigoPublico,
    titulo,
    descricao: texto(produto?.nome) || titulo,
    regras,
    tipo_desconto: "valor_fixo",
    desconto_percentual: null,
    valor_desconto: valorDesconto,
    pedido_minimo: pedidoMinimo,
    limite_desconto: limiteDesconto,
    publico_alvo: null,
    elegibilidade: "Sujeito às regras do Mercado Livre no checkout.",
    limite_por_usuario: null,
    somente_app: false,
    exige_mercado_pago: false,
    data_inicio: null,
    validade: candidato.validade,
    link_destino: linkDestino,
    link_afiliado: linkAfiliado,
    origem,
    origem_url: linkDestino,
    dedupe_key: dedupeCupom,
    dados_brutos: dadosBrutosPublicacao,
    coletado_em: agora,
    verificado_em: agora,
    updated_at: agora,
  };

  let cupomId = cupomExistente?.id as string | undefined;

  if (cupomId) {
    const { error } = await supabaseAdmin
      .from("economize_cupons")
      .update(cupomDados)
      .eq("id", cupomId);
    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: `Falha atualizando cupom: ${error.message}` },
        { status: 500 }
      );
    }
  } else {
    const { data, error } = await supabaseAdmin
      .from("economize_cupons")
      .insert(cupomDados)
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { sucesso: false, erro: `Falha criando cupom: ${error?.message || "sem retorno"}` },
        { status: 500 }
      );
    }
    cupomId = data.id;
  }

  const { error: erroVinculo } = await supabaseAdmin
    .from("economize_cupons_ofertas")
    .upsert(
      {
        cupom_id: cupomId,
        oferta_id: ofertaId,
        aplicacao: "confirmada",
        observacao: "Publicação ML V2 após validação comprador e link afiliado.",
      },
      { onConflict: "cupom_id,oferta_id" }
    );

  if (erroVinculo) {
    return NextResponse.json(
      { sucesso: false, erro: `Falha vinculando cupom e oferta: ${erroVinculo.message}` },
      { status: 500 }
    );
  }

  const { error: erroCandidatoUpdate } = await supabaseAdmin
    .from("economize_cupons_candidatos")
    .update({
      status: "publicado",
      publicado_em: agora,
      cupom_publicado_id: cupomId,
      updated_at: agora,
    })
    .eq("id", candidato.id)
    .eq("status", "aprovado");

  if (erroCandidatoUpdate) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: `Cupom publicado, mas falhou ao atualizar candidato: ${erroCandidatoUpdate.message}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    candidato_id: candidato.id,
    status: "publicado",
    cupom_id: cupomId,
    oferta_id: ofertaId,
    rota_publica: `/oferta/${ofertaId}`,
    afiliado_validado: true,
    afiliado_validado_por: validacaoAfiliado.modo_validacao,
  });
}
