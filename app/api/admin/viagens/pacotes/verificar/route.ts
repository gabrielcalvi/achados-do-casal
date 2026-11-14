import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairPacoteDecolar, type PacoteDecolarExtraido } from "@/lib/viagens/decolar";
import { extrairPacoteDecolarBrowser } from "@/lib/viagens/decolarBrowser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCORRENCIA = 1;
const FALHAS_PARA_INATIVAR = 2;
const RETENTATIVAS_BROWSER = 2;

type Estado = "disponivel" | "suspeito" | "indisponivel" | "erro";
type TipoOferta = "pacote" | "hotel" | "ingresso" | "carro" | "cruzeiro" | "passeio" | "outro";

type OfertaDb = {
  id: string;
  tipo: TipoOferta;
  status: string;
  titulo: string;
  parceiro: string;
  link_original: string | null;
  link_afiliado: string;
  data_ida: string | null;
  data_volta: string | null;
  hotel_nome: string | null;
  preco_total: number;
  preco_por_pessoa: number | null;
  validade: string | null;
  disponibilidade_falhas: number | null;
};

function autorizadoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch {
    return false;
  }
}

async function autorizado(request: NextRequest) {
  return autorizadoCron(request) || (await usuarioAutenticado());
}

function normalizar(valor: string | null | undefined) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(valor: string | null | undefined) {
  return new Set(normalizar(valor).split(" ").filter((item) => item.length >= 3));
}

function similaridade(a: string | null | undefined, b: string | null | undefined) {
  const aa = palavras(a);
  const bb = palavras(b);
  if (aa.size === 0 || bb.size === 0) return 0;
  let comuns = 0;
  for (const item of aa) if (bb.has(item)) comuns += 1;
  return comuns / Math.min(aa.size, bb.size);
}

function mensagemErro(erro: unknown) {
  return erro instanceof Error ? erro.message : String(erro || "");
}

function precisaFallbackBrowser(erro: unknown) {
  const mensagem = mensagemErro(erro).toLowerCase();
  return mensagem.includes("http 403") || mensagem.includes("forbidden") || mensagem.includes("access denied");
}

function erroTransitorioChromium(erro: unknown) {
  const mensagem = mensagemErro(erro).toLowerCase();
  return (
    mensagem.includes("etxtbsy") ||
    mensagem.includes("libnspr4") ||
    mensagem.includes("spawn") ||
    mensagem.includes("eacces") ||
    mensagem.includes("chromium")
  );
}

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extrairBrowserComRetry(link: string) {
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= RETENTATIVAS_BROWSER; tentativa += 1) {
    try {
      return await extrairPacoteDecolarBrowser(link);
    } catch (erro) {
      ultimoErro = erro;
      if (!erroTransitorioChromium(erro) || tentativa === RETENTATIVAS_BROWSER) throw erro;
      await dormir(1800);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro || "Falha no Chromium."));
}

async function extrair(link: string) {
  try {
    return await extrairPacoteDecolar(link);
  } catch (erro) {
    if (!precisaFallbackBrowser(erro)) throw erro;
    return await extrairBrowserComRetry(link);
  }
}

function dataPassou(valor: string | null | undefined) {
  if (!valor) return false;
  const data = new Date(`${String(valor).slice(0, 10)}T23:59:59Z`);
  return Number.isFinite(data.getTime()) && data.getTime() < Date.now();
}

function validadeExpirou(valor: string | null | undefined) {
  if (!valor) return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.getTime() <= Date.now();
}

function avaliarPacote(pacote: OfertaDb, dados: PacoteDecolarExtraido) {
  if (dataPassou(pacote.data_ida)) {
    return { estado: "indisponivel" as Estado, motivo: "data_de_ida_passou" };
  }
  if (validadeExpirou(pacote.validade)) {
    return { estado: "indisponivel" as Estado, motivo: "validade_expirada" };
  }

  const hotelIgual = similaridade(pacote.hotel_nome, dados.hotel_nome) >= 0.6;
  const datasDisponiveis = Boolean(dados.data_ida && dados.data_volta);
  const datasIguais =
    !datasDisponiveis ||
    (dados.data_ida === pacote.data_ida && dados.data_volta === pacote.data_volta);
  const temPreco = Number(dados.preco_total || dados.preco_por_pessoa || 0) > 0;

  if (hotelIgual && datasIguais && temPreco) {
    return { estado: "disponivel" as Estado, motivo: "hotel_datas_preco_confirmados" };
  }
  const sinaisSuficientes = Boolean(dados.hotel_nome) && (datasDisponiveis || temPreco);
  if (!sinaisSuficientes) return { estado: "erro" as Estado, motivo: "extracao_inconclusiva" };
  if (!hotelIgual) return { estado: "suspeito" as Estado, motivo: "hotel_nao_confere" };
  if (datasDisponiveis && !datasIguais) return { estado: "suspeito" as Estado, motivo: "datas_nao_conferem" };
  if (!temPreco) return { estado: "suspeito" as Estado, motivo: "preco_nao_encontrado" };
  return { estado: "erro" as Estado, motivo: "validacao_inconclusiva" };
}

async function atualizarSaude(
  tabela: "viagens_pacotes" | "viagens_ingressos",
  id: string,
  avaliacao: { estado: Estado; motivo: string },
  falhasAtuais: number | null,
  podeInativarPorSuspeita: boolean
) {
  const agora = new Date().toISOString();

  if (avaliacao.estado === "disponivel") {
    await supabaseAdmin.from(tabela).update({
      disponibilidade_status: "disponivel",
      disponibilidade_falhas: 0,
      disponibilidade_motivo: avaliacao.motivo,
      disponibilidade_verificada_em: agora,
      disponibilidade_ultima_ok_em: agora,
    }).eq("id", id);
    return "disponivel";
  }

  if (avaliacao.estado === "indisponivel") {
    await supabaseAdmin.from(tabela).update({
      status: "expirado",
      destaque: false,
      disponibilidade_status: "indisponivel",
      disponibilidade_falhas: FALHAS_PARA_INATIVAR,
      disponibilidade_motivo: avaliacao.motivo,
      disponibilidade_verificada_em: agora,
    }).eq("id", id);
    return "indisponivel";
  }

  if (avaliacao.estado === "erro") {
    await supabaseAdmin.from(tabela).update({
      disponibilidade_status: "erro",
      disponibilidade_motivo: avaliacao.motivo,
      disponibilidade_verificada_em: agora,
    }).eq("id", id);
    return "erro";
  }

  const falhas = Number(falhasAtuais || 0) + 1;
  const deveInativar = podeInativarPorSuspeita && falhas >= FALHAS_PARA_INATIVAR;
  await supabaseAdmin.from(tabela).update({
    ...(deveInativar ? { status: "inativo", destaque: false } : {}),
    disponibilidade_status: deveInativar ? "indisponivel" : "suspeito",
    disponibilidade_falhas: falhas,
    disponibilidade_motivo: avaliacao.motivo,
    disponibilidade_verificada_em: agora,
  }).eq("id", id);

  return deveInativar ? "indisponivel" : "suspeito";
}

async function verificarPacote(pacote: OfertaDb) {
  const agora = new Date().toISOString();

  if (pacote.parceiro.toLowerCase() !== "decolar" || !pacote.link_original) {
    await supabaseAdmin.from("viagens_pacotes").update({
      disponibilidade_status: "erro",
      disponibilidade_motivo: "parceiro_ou_link_nao_suportado",
      disponibilidade_verificada_em: agora,
    }).eq("id", pacote.id);
    return { id: pacote.id, tabela: "viagens_pacotes", titulo: pacote.titulo, status: "erro", motivo: "parceiro_ou_link_nao_suportado" };
  }

  try {
    const dados = await extrair(pacote.link_original);
    const avaliacao = avaliarPacote(pacote, dados);
    const status = await atualizarSaude(
      "viagens_pacotes",
      pacote.id,
      avaliacao,
      pacote.disponibilidade_falhas,
      true
    );
    return { id: pacote.id, tabela: "viagens_pacotes", titulo: pacote.titulo, status, motivo: avaliacao.motivo };
  } catch (erro) {
    const mensagem = mensagemErro(erro).slice(0, 500);
    await supabaseAdmin.from("viagens_pacotes").update({
      disponibilidade_status: "erro",
      disponibilidade_motivo: mensagem,
      disponibilidade_verificada_em: agora,
    }).eq("id", pacote.id);
    return { id: pacote.id, tabela: "viagens_pacotes", titulo: pacote.titulo, status: "erro", motivo: mensagem.slice(0, 180) };
  }
}

async function testarLink(link: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const resposta = await fetch(link, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AchadosDoCasalHealthCheck/1.0)",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
    });
    return { status: resposta.status, url: resposta.url };
  } finally {
    clearTimeout(timeout);
  }
}

async function verificarOfertaGenerica(oferta: OfertaDb) {
  if (validadeExpirou(oferta.validade)) {
    const avaliacao = { estado: "indisponivel" as Estado, motivo: "validade_expirada" };
    const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
    return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
  }
  if (["hotel", "carro", "cruzeiro"].includes(oferta.tipo) && dataPassou(oferta.data_volta || oferta.data_ida)) {
    const avaliacao = { estado: "indisponivel" as Estado, motivo: "data_final_passou" };
    const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
    return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
  }

  const link = oferta.link_original || oferta.link_afiliado;
  if (!link) {
    const avaliacao = { estado: "erro" as Estado, motivo: "link_ausente" };
    const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
    return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
  }

  try {
    const teste = await testarLink(link);
    if (teste.status >= 200 && teste.status < 400) {
      const avaliacao = { estado: "disponivel" as Estado, motivo: "link_parceiro_acessivel" };
      const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
      return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
    }
    if (teste.status === 404 || teste.status === 410) {
      const avaliacao = { estado: "suspeito" as Estado, motivo: `link_http_${teste.status}` };
      const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
      return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
    }
    const avaliacao = { estado: "erro" as Estado, motivo: `parceiro_bloqueou_verificacao_http_${teste.status}` };
    const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
    return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
  } catch (erro) {
    const avaliacao = { estado: "erro" as Estado, motivo: `falha_tecnica_link: ${mensagemErro(erro).slice(0, 180)}` };
    const status = await atualizarSaude("viagens_pacotes", oferta.id, avaliacao, oferta.disponibilidade_falhas, false);
    return { id: oferta.id, tabela: "viagens_pacotes", titulo: oferta.titulo, status, motivo: avaliacao.motivo };
  }
}

async function executarComConcorrencia<T, R>(itens: T[], limite: number, tarefa: (item: T) => Promise<R>) {
  const resultados: R[] = [];
  let indice = 0;
  async function worker() {
    while (true) {
      const atual = indice;
      indice += 1;
      if (atual >= itens.length) return;
      resultados[atual] = await tarefa(itens[atual]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, () => worker()));
  return resultados;
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  }

  const ofertasResp = await supabaseAdmin
    .from("viagens_pacotes")
    .select("id,tipo,status,titulo,parceiro,link_original,link_afiliado,data_ida,data_volta,hotel_nome,preco_total,preco_por_pessoa,validade,disponibilidade_falhas")
    .eq("status", "ativo")
    .is("arquivado_em", null)
    .order("disponibilidade_verificada_em", { ascending: true, nullsFirst: true })
    .limit(60);

  if (ofertasResp.error) {
    return NextResponse.json({ sucesso: false, erro: ofertasResp.error.message }, { status: 500 });
  }

  const ofertas = (ofertasResp.data ?? []) as OfertaDb[];
  const pacotes = ofertas.filter((item) => item.tipo === "pacote");
  const genericas = ofertas.filter((item) => item.tipo !== "pacote");

  const resultadosPacotes = await executarComConcorrencia(pacotes, MAX_CONCORRENCIA, verificarPacote);
  const resultadosGenericos = await executarComConcorrencia(genericas, 4, verificarOfertaGenerica);
  const resultados = [...resultadosPacotes, ...resultadosGenericos];

  const resumo = resultados.reduce<Record<string, number>>((acc, item: any) => {
    const chave = String(item.status || "desconhecido");
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    sucesso: true,
    modo: "saude_unificada",
    verificados: resultados.length,
    resumo,
    resultados,
    executado_em: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
