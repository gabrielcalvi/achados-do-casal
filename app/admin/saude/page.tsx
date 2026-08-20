import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CorrigirLinkProduto from "./CorrigirLinkProduto";

export const dynamic = "force-dynamic";

function formatarData(valor: string | null | undefined) {
  if (!valor) return "Sem registro";
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusClasse(status: "ok" | "atencao" | "erro") {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "atencao") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

function statusRotulo(status: "ok" | "atencao" | "erro") {
  if (status === "ok") return "● Saudável";
  if (status === "atencao") return "● Atenção";
  return "● Problema";
}

function temImagem(oferta: { imagem_url?: string | null }) {
  return Boolean(String(oferta.imagem_url || "").trim());
}

function temCodigo(oferta: { codigo?: string | null }) {
  return Boolean(String(oferta.codigo || "").trim());
}

function ofertaPublicaExibivel(oferta: { imagem_url?: string | null; codigo?: string | null }) {
  return temImagem(oferta) || temCodigo(oferta);
}

function exigeCategoria(oferta: { imagem_url?: string | null }) {
  return temImagem(oferta);
}

function erroDeLinkOriginal(erro: string | null | undefined) {
  return String(erro || "").toLowerCase().includes("sem link original");
}

export default async function AdminSaudePage() {
  const agora = new Date();
  const vinteQuatroHoras = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    lojasResponse,
    ofertasResponse,
    produtosResponse,
    falhasMonitorResponse,
    ultimaVerificacaoResponse,
    mlV2Response,
    ultimaColetaMlResponse,
    radaresResponse,
    precos24hResponse,
    ultimaExecucaoViagemResponse,
  ] = await Promise.all([
    supabaseAdmin
      .from("economize_lojas")
      .select("id,nome,slug,ativa")
      .eq("ativa", true)
      .order("ordem", { ascending: true }),
    supabaseAdmin
      .from("economize_ofertas")
      .select("id,loja_id,status,tipo,codigo,categoria,imagem_url,validade,updated_at,origem")
      .eq("status", "ativo"),
    supabaseAdmin
      .from("produtos")
      .select("id,nome,ativo,categoria,imagem")
      .eq("ativo", true),
    supabaseAdmin
      .from("produtos")
      .select("id,nome,link,monitor_erro,monitor_erro_em,monitor_falhas_consecutivas")
      .eq("ativo", true)
      .not("monitor_erro", "is", null)
      .order("monitor_erro_em", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("produtos")
      .select("ultima_verificacao")
      .not("ultima_verificacao", "is", null)
      .order("ultima_verificacao", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("economize_cupons_candidatos")
      .select("id,status,dados_brutos")
      .eq("origem", "mercado_livre_v2")
      .neq("status", "descartado"),
    supabaseAdmin
      .from("economize_cupons_candidatos")
      .select("ultima_coleta_em")
      .eq("origem", "mercado_livre_v2")
      .not("ultima_coleta_em", "is", null)
      .order("ultima_coleta_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("viagens_radares")
      .select("id,slug,nome,ativo")
      .eq("ativo", true),
    supabaseAdmin
      .from("viagens_precos")
      .select("id", { count: "exact", head: true })
      .gte("observado_em", vinteQuatroHoras),
    supabaseAdmin
      .from("viagens_execucoes")
      .select("status,erro,iniciada_em,finalizada_em")
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lojas = lojasResponse.data ?? [];
  const ofertas = ofertasResponse.data ?? [];
  const produtos = produtosResponse.data ?? [];
  const falhasMonitor = falhasMonitorResponse.data ?? [];
  const candidatosMl = mlV2Response.data ?? [];
  const radares = radaresResponse.data ?? [];

  const ofertasValidas = ofertas.filter((oferta) => {
    if (!oferta.validade) return true;
    return new Date(oferta.validade).getTime() > agora.getTime();
  });

  const ofertasPublicas = ofertasValidas.filter(ofertaPublicaExibivel);

  const semImagem = ofertasPublicas.filter(
    (oferta) => !temImagem(oferta) && !temCodigo(oferta)
  ).length;
  const semCategoria = ofertasPublicas.filter(
    (oferta) => exigeCategoria(oferta) && !String(oferta.categoria || "").trim()
  ).length;
  const produtosSemCategoria = produtos.filter(
    (produto) => !String(produto.categoria || "").trim()
  ).length;
  const produtosSemImagem = produtos.filter(
    (produto) => !String(produto.imagem || "").trim()
  ).length;

  const mlSemComissao = candidatosMl.filter((item) => {
    const bruto = (item.dados_brutos || {}) as Record<string, any>;
    const comissao = bruto.comissao_afiliado;
    return !comissao || typeof comissao.percentual !== "number";
  }).length;

  const lojasResumo = lojas.map((loja) => {
    const itensValidos = ofertasValidas.filter((oferta) => oferta.loja_id === loja.id);
    const itens = itensValidos.filter(ofertaPublicaExibivel);
    const semImagemLoja = itens.filter(
      (oferta) => !temImagem(oferta) && !temCodigo(oferta)
    ).length;
    const semCategoriaLoja = itens.filter(
      (oferta) => exigeCategoria(oferta) && !String(oferta.categoria || "").trim()
    ).length;
    const ultimaAtualizacao = itensValidos
      .map((item) => item.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    const status: "ok" | "atencao" | "erro" =
      itens.length === 0
        ? "atencao"
        : semImagemLoja > 0 || semCategoriaLoja > 0
          ? "atencao"
          : "ok";

    return {
      ...loja,
      ofertas: itens.length,
      semImagem: semImagemLoja,
      semCategoria: semCategoriaLoja,
      ultimaAtualizacao,
      status,
    };
  });

  const monitorStatus: "ok" | "atencao" | "erro" =
    falhasMonitor.length === 0 ? "ok" : falhasMonitor.length < 5 ? "atencao" : "erro";
  const mlStatus: "ok" | "atencao" | "erro" =
    candidatosMl.length === 0 ? "atencao" : mlSemComissao > 0 ? "atencao" : "ok";
  const viagensUltima = ultimaExecucaoViagemResponse.data;
  const viagensStatus: "ok" | "atencao" | "erro" =
    !viagensUltima
      ? "atencao"
      : viagensUltima.status === "sucesso"
        ? "ok"
        : viagensUltima.status === "erro"
          ? "erro"
          : "atencao";

  const qualidadeStatus: "ok" | "atencao" =
    semImagem + semCategoria + produtosSemCategoria + produtosSemImagem === 0 ? "ok" : "atencao";

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-slate-500">Achados do Casal</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Saúde do projeto</h1>
              <p className="mt-2 max-w-3xl text-slate-600">Visão rápida do que está saudável, do que precisa de atenção e do que realmente está quebrado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/monitor" className="rounded-xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50">Abrir monitor</Link>
              <Link href="/admin/viagens" className="rounded-xl border border-violet-300 px-4 py-3 font-black text-violet-700 hover:bg-violet-50">Abrir viagens</Link>
              <Link href="/admin/economize" className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800">Abrir Economize</Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className={`rounded-2xl border p-5 ${statusClasse(monitorStatus)}`}>
            <p className="text-xs font-black uppercase tracking-wide">Monitor de preços</p>
            <p className="mt-2 text-2xl font-black">{statusRotulo(monitorStatus)}</p>
            <p className="mt-2 text-sm font-bold">{produtos.length} produtos ativos · {falhasMonitor.length} falha(s)</p>
            <p className="mt-1 text-xs opacity-70">Última verificação: {formatarData(ultimaVerificacaoResponse.data?.ultima_verificacao)}</p>
          </article>

          <article className={`rounded-2xl border p-5 ${statusClasse(mlStatus)}`}>
            <p className="text-xs font-black uppercase tracking-wide">Mercado Livre V2</p>
            <p className="mt-2 text-2xl font-black">{statusRotulo(mlStatus)}</p>
            <p className="mt-2 text-sm font-bold">{candidatosMl.length} candidatos visíveis · {mlSemComissao} sem comissão verificada</p>
            <p className="mt-1 text-xs opacity-70">Última coleta: {formatarData(ultimaColetaMlResponse.data?.ultima_coleta_em)}</p>
          </article>

          <article className={`rounded-2xl border p-5 ${statusClasse(viagensStatus)}`}>
            <p className="text-xs font-black uppercase tracking-wide">Viagens / Radar</p>
            <p className="mt-2 text-2xl font-black">{statusRotulo(viagensStatus)}</p>
            <p className="mt-2 text-sm font-bold">{radares.length} radares ativos · {precos24hResponse.count ?? 0} preços nas últimas 24h</p>
            <p className="mt-1 text-xs opacity-70">Última execução: {formatarData(viagensUltima?.iniciada_em)}</p>
          </article>

          <article className={`rounded-2xl border p-5 ${statusClasse(qualidadeStatus)}`}>
            <p className="text-xs font-black uppercase tracking-wide">Qualidade dos dados</p>
            <p className="mt-2 text-2xl font-black">{statusRotulo(qualidadeStatus)}</p>
            <p className="mt-2 text-sm font-bold">{semImagem + produtosSemImagem} sem imagem · {semCategoria + produtosSemCategoria} sem categoria</p>
            <p className="mt-1 text-xs opacity-70">Cupons gerais sem produto não contam como falha visual</p>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Lojas e catálogos</h2>
              <p className="mt-1 text-sm text-slate-500">Itens públicos exibíveis, imagens e categorias por loja.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">{ofertasPublicas.length} ofertas públicas</span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-black">Loja</th>
                  <th className="px-4 py-3 font-black">Status</th>
                  <th className="px-4 py-3 font-black">Ofertas</th>
                  <th className="px-4 py-3 font-black">Sem imagem</th>
                  <th className="px-4 py-3 font-black">Sem categoria</th>
                  <th className="px-4 py-3 font-black">Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {lojasResumo.map((loja) => (
                  <tr key={loja.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-black">{loja.nome}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasse(loja.status)}`}>{statusRotulo(loja.status)}</span></td>
                    <td className="px-4 py-3 font-bold">{loja.ofertas}</td>
                    <td className={`px-4 py-3 font-bold ${loja.semImagem ? "text-red-600" : "text-emerald-600"}`}>{loja.semImagem}</td>
                    <td className={`px-4 py-3 font-bold ${loja.semCategoria ? "text-amber-600" : "text-emerald-600"}`}>{loja.semCategoria}</td>
                    <td className="px-4 py-3 text-slate-500">{formatarData(loja.ultimaAtualizacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(falhasMonitor.length > 0 || viagensUltima?.erro) && (
          <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black">Problemas que exigem atenção</h2>
            <div className="mt-4 grid gap-3">
              {falhasMonitor.slice(0, 8).map((produto) => {
                const faltaLinkOriginal = erroDeLinkOriginal(produto.monitor_erro);

                return (
                  <div
                    key={produto.id}
                    className={`rounded-2xl border p-4 ${
                      faltaLinkOriginal
                        ? "border-amber-200 bg-amber-50"
                        : "border-red-100 bg-red-50"
                    }`}
                  >
                    <p className="font-black text-slate-950">{produto.nome}</p>
                    <p className={`mt-1 text-sm font-bold ${faltaLinkOriginal ? "text-amber-800" : "text-red-700"}`}>
                      {produto.monitor_erro}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {produto.monitor_falhas_consecutivas ?? 0} falha(s) consecutiva(s) · {formatarData(produto.monitor_erro_em)}
                    </p>
                    {faltaLinkOriginal ? (
                      <CorrigirLinkProduto produtoId={produto.id} linkAtual={produto.link} />
                    ) : null}
                  </div>
                );
              })}
              {viagensUltima?.erro ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="font-black text-slate-950">Radar de viagens</p>
                  <p className="mt-1 text-sm font-bold text-red-700">{viagensUltima.erro}</p>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}