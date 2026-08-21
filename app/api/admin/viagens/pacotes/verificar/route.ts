import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairPacoteDecolar, type PacoteDecolarExtraido } from "@/lib/viagens/decolar";
import { extrairPacoteDecolarBrowser } from "@/lib/viagens/decolarBrowser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCORRENCIA = 2;
const FALHAS_PARA_INATIVAR = 2;

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

function precisaFallbackBrowser(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message.toLowerCase() : String(erro || "").toLowerCase();
  return mensagem.includes("http 403") || mensagem.includes("forbidden") || mensagem.includes("access denied");
}

async function extrair(link: string) {
  try {
    return await extrairPacoteDecolar(link);
  } catch (erro) {
    if (!precisaFallbackBrowser(erro)) throw erro;
    return await extrairPacoteDecolarBrowser(link);
  }
}

type PacoteDb = {
  id: string;
  status: string;
  titulo: string;
  parceiro: string;
  link_original: string | null;
  data_ida: string;
  data_volta: string;
  hotel_nome: string;
  preco_total: number;
  preco_por_pessoa: number | null;
  validade: string | null;
  disponibilidade_falhas: number | null;
};

function avaliar(pacote: PacoteDb, dados: PacoteDecolarExtraido) {
  const hoje = new Date();
  const ida = new Date(`${pacote.data_ida}T23:59:59Z`);
  if (Number.isFinite(ida.getTime()) && ida.getTime() < hoje.getTime()) {
    return { estado: "indisponivel" as const, motivo: "data_de_ida_passou" };
  }

  if (pacote.validade) {
    const validade = new Date(pacote.validade);
    if (Number.isFinite(validade.getTime()) && validade.getTime() <= hoje.getTime()) {
      return { estado: "indisponivel" as const, motivo: "validade_expirada" };
    }
  }

  const hotelIgual = similaridade(pacote.hotel_nome, dados.hotel_nome) >= 0.6;
  const datasDisponiveis = Boolean(dados.data_ida && dados.data_volta);
  const datasIguais = !datasDisponiveis || (dados.data_ida === pacote.data_ida && dados.data_volta === pacote.data_volta);
  const temPreco = Number(dados.preco_total || dados.preco_por_pessoa || 0) > 0;

  if (hotelIgual && datasIguais && temPreco) {
    return { estado: "disponivel" as const, motivo: "hotel_datas_preco_confirmados" };
  }

  const sinaisSuficientes = Boolean(dados.hotel_nome) && (datasDisponiveis || temPreco);
  if (!sinaisSuficientes) {
    return { estado: "erro" as const, motivo: "extracao_inconclusiva" };
  }

  if (!hotelIgual) {
    return { estado: "suspeito" as const, motivo: "hotel_nao_confere" };
  }

  if (datasDisponiveis && !datasIguais) {
    return { estado: "suspeito" as const, motivo: "datas_nao_conferem" };
  }

  if (!temPreco) {
    return { estado: "suspeito" as const, motivo: "preco_nao_encontrado" };
  }

  return { estado: "erro" as const, motivo: "validacao_inconclusiva" };
}

async function verificarPacote(pacote: PacoteDb) {
  const agora = new Date().toISOString();

  if (pacote.parceiro.toLowerCase() !== "decolar" || !pacote.link_original) {
    await supabaseAdmin.from("viagens_pacotes").update({
      disponibilidade_status: "erro",
      disponibilidade_motivo: "parceiro_ou_link_nao_suportado",
      disponibilidade_verificada_em: agora,
    }).eq("id", pacote.id);
    return { id: pacote.id, titulo: pacote.titulo, status: "erro", motivo: "parceiro_ou_link_nao_suportado" };
  }

  try {
    const dados = await extrair(pacote.link_original);
    const avaliacao = avaliar(pacote, dados);

    if (avaliacao.estado === "disponivel") {
      await supabaseAdmin.from("viagens_pacotes").update({
        disponibilidade_status: "disponivel",
        disponibilidade_falhas: 0,
        disponibilidade_motivo: avaliacao.motivo,
        disponibilidade_verificada_em: agora,
        disponibilidade_ultima_ok_em: agora,
      }).eq("id", pacote.id);

      return { id: pacote.id, titulo: pacote.titulo, status: "disponivel", motivo: avaliacao.motivo };
    }

    if (avaliacao.estado === "indisponivel") {
      await supabaseAdmin.from("viagens_pacotes").update({
        status: "expirado",
        destaque: false,
        disponibilidade_status: "indisponivel",
        disponibilidade_falhas: FALHAS_PARA_INATIVAR,
        disponibilidade_motivo: avaliacao.motivo,
        disponibilidade_verificada_em: agora,
      }).eq("id", pacote.id);

      return { id: pacote.id, titulo: pacote.titulo, status: "expirado", motivo: avaliacao.motivo };
    }

    if (avaliacao.estado === "erro") {
      await supabaseAdmin.from("viagens_pacotes").update({
        disponibilidade_status: "erro",
        disponibilidade_motivo: avaliacao.motivo,
        disponibilidade_verificada_em: agora,
      }).eq("id", pacote.id);

      return { id: pacote.id, titulo: pacote.titulo, status: "erro", motivo: avaliacao.motivo };
    }

    const falhas = Number(pacote.disponibilidade_falhas || 0) + 1;
    const deveInativar = falhas >= FALHAS_PARA_INATIVAR;

    await supabaseAdmin.from("viagens_pacotes").update({
      ...(deveInativar ? { status: "inativo", destaque: false } : {}),
      disponibilidade_status: deveInativar ? "indisponivel" : "suspeito",
      disponibilidade_falhas: falhas,
      disponibilidade_motivo: avaliacao.motivo,
      disponibilidade_verificada_em: agora,
    }).eq("id", pacote.id);

    return {
      id: pacote.id,
      titulo: pacote.titulo,
      status: deveInativar ? "inativado" : "suspeito",
      motivo: avaliacao.motivo,
      falhas,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await supabaseAdmin.from("viagens_pacotes").update({
      disponibilidade_status: "erro",
      disponibilidade_motivo: mensagem.slice(0, 500),
      disponibilidade_verificada_em: agora,
    }).eq("id", pacote.id);

    return { id: pacote.id, titulo: pacote.titulo, status: "erro", motivo: mensagem.slice(0, 180) };
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

  const { data, error } = await supabaseAdmin
    .from("viagens_pacotes")
    .select("id,status,titulo,parceiro,link_original,data_ida,data_volta,hotel_nome,preco_total,preco_por_pessoa,validade,disponibilidade_falhas")
    .eq("status", "ativo")
    .order("disponibilidade_verificada_em", { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
  }

  const pacotes = (data ?? []) as PacoteDb[];
  const resultados = await executarComConcorrencia(pacotes, MAX_CONCORRENCIA, verificarPacote);

  const resumo = resultados.reduce<Record<string, number>>((acc, item: any) => {
    const chave = String(item.status || "desconhecido");
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    sucesso: true,
    verificados: resultados.length,
    resumo,
    resultados,
    executado_em: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
