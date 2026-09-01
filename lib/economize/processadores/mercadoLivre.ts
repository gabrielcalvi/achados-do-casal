import {
  extrairOfertasMercadoLivre,
  type OfertaMercadoLivreExtraida,
} from "@/lib/economize/extratores/mercadoLivreOfertas";
import { categorizarProduto } from "@/lib/economize/categorizarProduto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const LIMITE_CONSULTA_MS = 20000;

export type FonteMercadoLivre = {
  id: string;
  loja_id: string;
  nome: string;
  url: string;
  ativa: boolean;
  prioridade: number;
  intervalo_minutos: number;
};

type OfertaExistente = {
  id: string;
  dedupe_key: string;
  titulo: string | null;
  categoria: string | null;
  imagem_url: string | null;
  link_destino: string | null;
  preco_original: number | string | null;
  preco_oferta: number | string | null;
  desconto_percentual: number | string | null;
  dados_brutos: Record<string, unknown> | null;
};

export type ResultadoProcessamentoMercadoLivre = {
  fonte_id: string;
  fonte_nome: string;
  loja_id: string;
  ofertas_encontradas: number;
  ofertas_novas: number;
  ofertas_atualizadas: number;
  ofertas_sem_alteracao: number;
  total_erros: number;
  erros: string[];
  duracao_ms: number;
};

function obterMensagemErro(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Erro inesperado durante o processamento.";
}

function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function numeroOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function numerosIguais(primeiro: unknown, segundo: unknown) {
  const numeroPrimeiro = numeroOuNull(primeiro);
  const numeroSegundo = numeroOuNull(segundo);
  if (numeroPrimeiro === null && numeroSegundo === null) return true;
  if (numeroPrimeiro === null || numeroSegundo === null) return false;
  return Math.abs(numeroPrimeiro - numeroSegundo) < 0.001;
}

function textosIguais(primeiro: string | null, segundo: string | null) {
  return (primeiro ?? "").trim() === (segundo ?? "").trim();
}

function ofertaFoiAlterada(existente: OfertaExistente, extraida: OfertaMercadoLivreExtraida) {
  if (!textosIguais(existente.titulo, extraida.titulo)) return true;
  if (!textosIguais(existente.imagem_url, extraida.imagem_url)) return true;
  if (!textosIguais(existente.link_destino, extraida.link_destino)) return true;
  if (!numerosIguais(existente.preco_original, extraida.preco_original)) return true;
  if (!numerosIguais(existente.preco_oferta, extraida.preco_oferta)) return true;
  if (!numerosIguais(existente.desconto_percentual, extraida.desconto_percentual)) return true;
  return false;
}

function montarDadosBrutos(
  fonte: FonteMercadoLivre,
  oferta: OfertaMercadoLivreExtraida,
  dadosAnteriores?: Record<string, unknown> | null
) {
  return {
    ...(objetoSimples(dadosAnteriores) ? dadosAnteriores : {}),
    ...oferta.dados_brutos,
    codigo: oferta.codigo,
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    loja_id: fonte.loja_id,
    processador: "mercado-livre-v1",
  };
}

async function baixarHtml(url: string) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), LIMITE_CONSULTA_MS);
  try {
    const resposta = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controlador.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      },
    });
    if (!resposta.ok) throw new Error(`A fonte respondeu com HTTP ${resposta.status}.`);
    const contentType = resposta.headers.get("content-type");
    if (contentType && !contentType.includes("text/html")) {
      throw new Error(`A fonte retornou um conteúdo inesperado: ${contentType}.`);
    }
    return await resposta.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A consulta ao Mercado Livre excedeu 20 segundos.");
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

async function carregarOfertasExistentes(lojaId: string, chaves: string[]) {
  if (chaves.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("economize_ofertas")
    .select(`id,dedupe_key,titulo,categoria,imagem_url,link_destino,preco_original,preco_oferta,desconto_percentual,dados_brutos`)
    .eq("loja_id", lojaId)
    .in("dedupe_key", chaves);
  if (error) throw new Error(`Não foi possível consultar as ofertas existentes: ${error.message}`);
  return (data ?? []) as OfertaExistente[];
}

export async function processarFonteMercadoLivre(
  fonte: FonteMercadoLivre
): Promise<ResultadoProcessamentoMercadoLivre> {
  const inicio = Date.now();
  const erros: string[] = [];
  let ofertasNovas = 0;
  let ofertasAtualizadas = 0;
  let ofertasSemAlteracao = 0;

  if (!fonte.ativa) throw new Error("A fonte do Mercado Livre está inativa.");
  if (!fonte.url) throw new Error("A fonte do Mercado Livre não possui URL.");

  const html = await baixarHtml(fonte.url);
  const ofertasExtraidas = extrairOfertasMercadoLivre(html, fonte.url);
  if (ofertasExtraidas.length === 0) {
    throw new Error("Nenhuma oferta válida foi encontrada no HTML recebido.");
  }

  const chaves = ofertasExtraidas.map((oferta) => oferta.dedupe_key);
  const ofertasExistentes = await carregarOfertasExistentes(fonte.loja_id, chaves);
  const mapaExistentes = new Map(ofertasExistentes.map((oferta) => [oferta.dedupe_key, oferta]));
  const agora = new Date().toISOString();

  const novas = ofertasExtraidas
    .filter((oferta) => !mapaExistentes.has(oferta.dedupe_key))
    .map((oferta) => ({
      loja_id: fonte.loja_id,
      tipo: "promocao",
      status: "pendente",
      titulo: oferta.titulo,
      categoria: categorizarProduto(oferta.titulo),
      imagem_url: oferta.imagem_url,
      link_destino: oferta.link_destino,
      preco_original: oferta.preco_original,
      preco_oferta: oferta.preco_oferta,
      desconto_percentual: oferta.desconto_percentual,
      origem: "agente",
      origem_url: fonte.url,
      dedupe_key: oferta.dedupe_key,
      dados_brutos: montarDadosBrutos(fonte, oferta),
      coletado_em: agora,
    }));

  if (novas.length > 0) {
    const { error: erroInsercao } = await supabaseAdmin.from("economize_ofertas").insert(novas);
    if (erroInsercao) throw new Error(`Não foi possível inserir as novas ofertas: ${erroInsercao.message}`);
    ofertasNovas = novas.length;
  }

  const ofertasParaAtualizar = ofertasExtraidas.filter((oferta) => mapaExistentes.has(oferta.dedupe_key));

  for (const oferta of ofertasParaAtualizar) {
    const existente = mapaExistentes.get(oferta.dedupe_key);
    if (!existente) continue;

    const categoriaAtual = (existente.categoria ?? "").trim();
    const categoria = categoriaAtual || categorizarProduto(oferta.titulo);
    const precisaCategoria = !categoriaAtual;

    if (!ofertaFoiAlterada(existente, oferta) && !precisaCategoria) {
      ofertasSemAlteracao += 1;
      continue;
    }

    const { error: erroAtualizacao } = await supabaseAdmin
      .from("economize_ofertas")
      .update({
        titulo: oferta.titulo,
        categoria,
        imagem_url: oferta.imagem_url,
        link_destino: oferta.link_destino,
        preco_original: oferta.preco_original,
        preco_oferta: oferta.preco_oferta,
        desconto_percentual: oferta.desconto_percentual,
        dados_brutos: montarDadosBrutos(fonte, oferta, existente.dados_brutos),
        coletado_em: agora,
      })
      .eq("id", existente.id);

    if (erroAtualizacao) {
      erros.push(`${oferta.titulo}: ${erroAtualizacao.message}`);
      continue;
    }

    ofertasAtualizadas += 1;
  }

  return {
    fonte_id: fonte.id,
    fonte_nome: fonte.nome,
    loja_id: fonte.loja_id,
    ofertas_encontradas: ofertasExtraidas.length,
    ofertas_novas: ofertasNovas,
    ofertas_atualizadas: ofertasAtualizadas,
    ofertas_sem_alteracao: ofertasSemAlteracao,
    total_erros: erros.length,
    erros,
    duracao_ms: Math.max(Date.now() - inicio, 1),
  };
}

export function mensagemErroProcessamentoMercadoLivre(error: unknown) {
  return obterMensagemErro(error);
}
