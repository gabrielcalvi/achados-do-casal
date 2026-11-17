import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CorrigirLinkProduto from "./CorrigirLinkProduto";
import ExecutarWatchdog from "./ExecutarWatchdog";
import { consultarListaMercadoLivre, extrairItemIdMercadoLivre } from "@/lib/services/mercadoLivreHttpMonitor";

export const dynamic = "force-dynamic";

function formatarData(valor: string | null | undefined) {
  if (!valor) return "Sem registro";
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarMoeda(valor: number | string | null | undefined) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarParcelas(valor: string | null | undefined) {
  return String(valor || "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .replace(/r\$\s*/g, "r$")
    .trim();
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

function exigeCategoria(oferta: { imagem_url?: string | null; origem?: string | null }) {
  if (!temImagem(oferta)) return false;
  const origem = String(oferta.origem || "").trim();
  return origem === "agente" || origem.startsWith("agente_produtos_awin_");
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
    watchdogStatusResponse,
    watchdogExecucaoResponse,
    pedidosReviewResponse,
    alertasAtingidosResponse,
    listaMlResponse,
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
      .select("id,nome,ativo,categoria,imagem,loja,link,link_afiliado,preco_atual,parcelas,ultima_verificacao,preco_manual_atualizado_em,monitor_erro,monitor_erro_em,monitor_falhas_consecutivas,monitoramento_manual,tem_em_casa,video_url")
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
    supabaseAdmin
      .from("sistema_watchdog_status")
      .select("chave,titulo,status,mensagem,metricas,verificado_em,recuperacao_tentada_em,recuperacao_resultado")
      .order("titulo", { ascending: true }),
    supabaseAdmin
      .from("sistema_watchdog_execucoes")
      .select("status,problemas,recuperacoes,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("produto_solicitacoes_review")
      .select("id", { count: "exact", head: true })
      .eq("status", "novo"),
    supabaseAdmin
      .from("produto_alertas_preco")
      .select("id", { count: "exact", head: true })
      .eq("status", "atingido"),
    consultarListaMercadoLivre()
      .then((data) => ({ data, error: null as string | null }))
      .catch((error) => ({
        data: null,
        error: error instanceof Error ? error.message : String(error),
      })),
  ]);

  const lojas = lojasResponse.data ?? [];
  const ofertas = ofertasResponse.data ?? [];
  const produtos = produtosResponse.data ?? [];
  const falhasMonitor = falhasMonitorResponse.data ?? [];
  const candidatosMl = mlV2Response.data ?? [];
  const radares = radaresResponse.data ?? [];
  const watchdogChecks = watchdogStatusResponse.data ?? [];
  const watchdogUltimo = watchdogExecucaoResponse.data;
  const pedidosReviewNovos = pedidosReviewResponse.count ?? 0;
  const alertasAtingidos = alertasAtingidosResponse.count ?? 0;
  const listaMl = listaMlResponse.data;
  const erroListaMl = listaMlResponse.error;

  const mapaListaMl = new Map(
    (listaMl?.itens ?? []).map((item) => [item.itemId, item])
  );

  const produtosSaude = produtos
    .map((produto) => {
      const loja = String(produto.loja || "");
      const mercadoLivre = loja.toLocaleLowerCase("pt-BR").includes("mercado livre");
      const itemId = mercadoLivre
        ? extrairItemIdMercadoLivre(String(produto.link || ""))
        : null;
      const itemLista = itemId ? mapaListaMl.get(itemId) ?? null : null;

      const precoAtual = Number(produto.preco_atual);
      const precoLista = itemLista?.preco ?? null;
      const precoDiferente =
        mercadoLivre &&
        precoLista !== null &&
        Number.isFinite(precoAtual) &&
        Math.abs(precoLista - precoAtual) >= 0.01;

      const parcelasAtual = String(produto.parcelas || "").trim() || null;
      const parcelasLista = itemLista?.parcelas?.trim() || null;
      const parcelasDiferentes =
        mercadoLivre &&
        Boolean(parcelasLista) &&
        normalizarParcelas(parcelasAtual) !== normalizarParcelas(parcelasLista);

      let status: "ok" | "atencao" | "erro" = "ok";
      let acao = "Nenhuma ação";
      let detalhe = mercadoLivre ? "Na lista do Mercado Livre" : "Monitor automático";

      if (produto.monitor_erro) {
        status = "erro";
        acao = "Corrigir falha do monitor";
        detalhe = String(produto.monitor_erro);
      } else if (mercadoLivre && erroListaMl) {
        status = "atencao";
        acao = "Revisar lista do ML";
        detalhe = "Lista do Mercado Livre indisponível nesta leitura";
      } else if (mercadoLivre && !itemId) {
        status = "erro";
        acao = "Corrigir link original";
        detalhe = "ITEM_ID do Mercado Livre não identificado";
      } else if (mercadoLivre && !itemLista) {
        status = "atencao";
        acao = "Adicionar à lista ML ou desativar";
        detalhe = "Produto ativo no Achados, mas fora da lista oficial";
      } else if (precoDiferente || parcelasDiferentes) {
        status = "atencao";
        const partes = [];
        if (precoDiferente) partes.push(`preço → ${formatarMoeda(precoLista)}`);
        if (parcelasDiferentes) partes.push(`parcelas → ${parcelasLista}`);
        acao = `Atualizar ${partes.join(" · ")}`;
        detalhe = "Diferença encontrada na lista do Mercado Livre";
      }

      return {
        ...produto,
        mercadoLivre,
        itemId,
        itemLista,
        precoDiferente,
        parcelasDiferentes,
        status,
        acao,
        detalhe,
      };
    })
    .sort((a, b) => {
      const peso = { erro: 0, atencao: 1, ok: 2 } as const;
      const diferenca = peso[a.status] - peso[b.status];
      if (diferenca !== 0) return diferenca;
      return String(a.nome).localeCompare(String(b.nome), "pt-BR");
    });

  const mlParaAtualizar = produtosSaude.filter(
    (produto) => produto.mercadoLivre && (produto.precoDiferente || produto.parcelasDiferentes)
  );
  const mlForaDaLista = produtosSaude.filter(
    (produto) =>
      produto.mercadoLivre &&
      Boolean(produto.itemId) &&
      !produto.itemLista &&
      !erroListaMl
  );
  const videosPendentes = produtos.filter(
    (produto) => produto.tem_em_casa && !String(produto.video_url || "").trim()
  ).length;

  const acoesHoje = [
    {
      titulo: "Falhas de monitor",
      valor: falhasMonitor.length,
      detalhe: falhasMonitor.length ? "Produto(s) exigem correção." : "Sem falhas abertas.",
      href: "#problemas-monitor",
      tom: falhasMonitor.length ? "erro" : "ok",
    },
    {
      titulo: "Mercado Livre",
      valor: mlParaAtualizar.length + mlForaDaLista.length,
      detalhe: erroListaMl
        ? "Lista indisponível nesta leitura."
        : `${mlParaAtualizar.length} para atualizar · ${mlForaDaLista.length} fora da lista`,
      href: "#saude-produtos",
      tom: erroListaMl || mlParaAtualizar.length || mlForaDaLista.length ? "atencao" : "ok",
    },
    {
      titulo: "Vídeos pendentes",
      valor: videosPendentes,
      detalhe: videosPendentes ? "Produtos em casa ainda sem vídeo." : "Fila em dia.",
      href: "/admin/economize/performance",
      tom: videosPendentes ? "atencao" : "ok",
    },
    {
      titulo: "Pedidos de review",
      valor: pedidosReviewNovos,
      detalhe: pedidosReviewNovos ? "Novos pedidos da comunidade." : "Nenhum pedido novo.",
      href: "/admin/comunidade",
      tom: pedidosReviewNovos ? "atencao" : "ok",
    },
    {
      titulo: "Alertas atingidos",
      valor: alertasAtingidos,
      detalhe: alertasAtingidos ? "Preço-alvo atingido; revisar aviso." : "Nenhum alerta aguardando ação.",
      href: "/admin/comunidade",
      tom: alertasAtingidos ? "atencao" : "ok",
    },
  ] as const;

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

  const watchdogGeral: "ok" | "atencao" | "erro" =
    watchdogUltimo?.status === "erro"
      ? "erro"
      : watchdogUltimo?.status === "atencao"
        ? "atencao"
        : watchdogUltimo?.status === "ok"
          ? "ok"
          : "atencao";

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

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-pink-600">Painel operacional</p>
              <h2 className="mt-1 text-3xl font-black">Ações de hoje</h2>
              <p className="mt-2 text-sm text-slate-600">Só o que merece atenção agora. Se zerou, não vira tarefa.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
              {acoesHoje.reduce((total, item) => total + item.valor, 0)} pendência(s)
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {acoesHoje.map((item) => {
              const classe =
                item.tom === "erro"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : item.tom === "atencao"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800";

              return (
                <Link
                  key={item.titulo}
                  href={item.href}
                  className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${classe}`}
                >
                  <p className="text-xs font-black uppercase tracking-wide opacity-75">{item.titulo}</p>
                  <p className="mt-2 text-3xl font-black">{item.valor}</p>
                  <p className="mt-2 text-xs font-bold leading-5 opacity-85">{item.detalhe}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Watchdog automático</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black">Fiscal do sistema</h2>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasse(watchdogGeral)}`}>{statusRotulo(watchdogGeral)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {watchdogUltimo
                  ? `${watchdogUltimo.problemas ?? 0} ponto(s) com atenção · ${watchdogUltimo.recuperacoes ?? 0} recuperação(ões) tentada(s)`
                  : "Ainda sem rodada registrada. O cron roda de hora em hora."}
              </p>
              <p className="mt-1 text-xs text-slate-500">Última rodada: {formatarData(watchdogUltimo?.created_at)}</p>
            </div>
            <ExecutarWatchdog />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watchdogChecks.length ? watchdogChecks.map((check) => {
              const status = (check.status === "ok" || check.status === "erro" ? check.status : "atencao") as "ok" | "atencao" | "erro";
              const metricas = (check.metricas || {}) as Record<string, unknown>;
              const ativos = typeof metricas.ativos === "number" ? metricas.ativos : null;
              const pendentes = typeof metricas.pendentes === "number" ? metricas.pendentes : null;

              return (
                <article key={check.chave} className={`rounded-2xl border p-4 ${statusClasse(status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-black">{check.titulo}</p>
                    <span className="text-xs font-black">{statusRotulo(status)}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold">{check.mensagem}</p>
                  {ativos !== null || pendentes !== null ? (
                    <p className="mt-2 text-xs opacity-80">{ativos ?? 0} ativos · {pendentes ?? 0} pendentes</p>
                  ) : null}
                  <p className="mt-1 text-xs opacity-70">Verificado: {formatarData(check.verificado_em)}</p>
                  {check.recuperacao_tentada_em ? (
                    <p className="mt-1 text-xs font-bold">Recuperação tentada: {formatarData(check.recuperacao_tentada_em)}</p>
                  ) : null}
                </article>
              );
            }) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 md:col-span-2 xl:col-span-3">
                Nenhum diagnóstico registrado ainda. Use “Rodar diagnóstico agora” para criar a primeira fotografia do sistema.
              </div>
            )}
          </div>
        </section>

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
            <p className="mt-1 text-xs opacity-70">Só produtos de catálogo entram na exigência de categoria; cupons gerais ficam fora.</p>
          </article>
        </section>

        <section id="saude-produtos" className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-blue-600">Catálogo completo</p>
              <h2 className="mt-1 text-2xl font-black">Saúde geral dos produtos</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Mercado Livre é cruzado com a lista oficial. Demais lojas seguem o monitor normal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">{produtosSaude.length} ativos</span>
              {listaMl ? (
                <span className="rounded-full bg-yellow-50 px-4 py-2 text-sm font-black text-yellow-800">
                  {listaMl.totalItensIdentificados} itens na lista ML
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700">
                  Lista ML indisponível
                </span>
              )}
            </div>
          </div>

          {erroListaMl ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              Não foi possível ler a lista do Mercado Livre nesta abertura: {erroListaMl}. Nenhum status de preço do ML foi inventado.
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-black">Produto</th>
                  <th className="px-4 py-3 font-black">Loja</th>
                  <th className="px-4 py-3 font-black">Status</th>
                  <th className="px-4 py-3 font-black">Preço Achados</th>
                  <th className="px-4 py-3 font-black">Referência</th>
                  <th className="px-4 py-3 font-black">Parcelas</th>
                  <th className="px-4 py-3 font-black">Última verificação</th>
                  <th className="px-4 py-3 font-black">Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtosSaude.map((produto) => (
                  <tr key={produto.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <p className="max-w-[280px] font-black text-slate-950">{produto.nome}</p>
                      <p className="mt-1 text-xs text-slate-400">ID {produto.id}{produto.itemId ? ` · ${produto.itemId}` : ""}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-600">{produto.loja || "—"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasse(produto.status)}`}>
                        {statusRotulo(produto.status)}
                      </span>
                      <p className="mt-2 max-w-[220px] text-xs text-slate-500">{produto.detalhe}</p>
                    </td>
                    <td className="px-4 py-4 font-black">{formatarMoeda(produto.preco_atual)}</td>
                    <td className="px-4 py-4">
                      {produto.mercadoLivre ? (
                        produto.itemLista ? (
                          <div>
                            <p className={`font-black ${produto.precoDiferente ? "text-amber-700" : "text-emerald-700"}`}>
                              {formatarMoeda(produto.itemLista.preco)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">Lista ML</p>
                          </div>
                        ) : (
                          <span className="font-bold text-amber-700">Fora da lista</span>
                        )
                      ) : (
                        <span className="font-bold text-slate-500">Monitor automático</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-700">{produto.parcelas || "—"}</p>
                      {produto.mercadoLivre && produto.itemLista?.parcelas ? (
                        <p className={`mt-1 text-xs font-black ${produto.parcelasDiferentes ? "text-amber-700" : "text-emerald-700"}`}>
                          ML: {produto.itemLista.parcelas}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatarData(
                        produto.mercadoLivre
                          ? produto.preco_manual_atualizado_em || produto.ultima_verificacao
                          : produto.ultima_verificacao
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className={`max-w-[260px] text-sm font-black ${produto.status === "ok" ? "text-emerald-700" : produto.status === "erro" ? "text-red-700" : "text-amber-800"}`}>
                        {produto.acao}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/produto/${produto.id}`} target="_blank" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">
                          Ver página ↗
                        </Link>
                        {produto.status !== "ok" ? (
                          <Link href="/admin" className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-800">
                            Editar
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <section id="problemas-monitor" className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
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
