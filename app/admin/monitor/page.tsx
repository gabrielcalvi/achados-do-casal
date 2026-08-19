import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ExecutarMonitorButton from "./ExecutarMonitorButton";

function formatarPreco(valor: string | null) {
  if (!valor) return "—";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return valor;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string | null) {
  if (!data) return "Ainda não verificado";
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function MonitorPage() {
  const [
    produtosResponse,
    alteracoesResponse,
    ultimaVerificacaoResponse,
    errosResponse,
  ] = await Promise.all([
    supabaseAdmin
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),

    supabaseAdmin
      .from("monitor_alteracoes")
      .select(`
        id,
        produto_id,
        tipo,
        valor_antigo,
        valor_novo,
        status,
        criado_em,
        aprovado_em,
        produtos (
          nome,
          imagem,
          link
        )
      `)
      .eq("status", "aprovado")
      .eq("tipo", "preco")
      .order("aprovado_em", { ascending: false })
      .limit(20),

    supabaseAdmin
      .from("produtos")
      .select("ultima_verificacao")
      .not("ultima_verificacao", "is", null)
      .order("ultima_verificacao", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin
      .from("produtos")
      .select("id,nome,imagem,link,monitor_erro,monitor_erro_em,monitor_falhas_consecutivas")
      .eq("ativo", true)
      .not("monitor_erro", "is", null)
      .order("monitor_erro_em", { ascending: false })
      .limit(20),
  ]);

  const alteracoes = alteracoesResponse.data ?? [];
  const erros = errosResponse.data ?? [];
  const totalProdutos = produtosResponse.count ?? 0;
  const ultimaVerificacao = ultimaVerificacaoResponse.data?.ultima_verificacao ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8 lg:px-16">
      <section className="mx-auto max-w-7xl">
        <p className="font-black text-pink-500">ACHADOS DO CASAL</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">Monitor de preços</h1>
        <p className="mt-3 text-base text-slate-600">
          Os preços válidos são atualizados automaticamente. Produtos que retornam R$ 0 são tratados como indisponíveis e saem do ar.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <nav className="flex gap-2">
            <Link href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700">
              Produtos
            </Link>
            <Link href="/admin/monitor" className="rounded-xl bg-slate-900 px-4 py-3 font-black text-white">
              Monitor
            </Link>
          </nav>
          <ExecutarMonitorButton />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Produtos monitorados</p>
            <strong className="mt-3 block text-3xl text-slate-950">{totalProdutos}</strong>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Falhas atuais</p>
            <strong className={`mt-3 block text-3xl ${erros.length ? "text-red-600" : "text-emerald-600"}`}>
              {erros.length}
            </strong>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Status</p>
            <strong className="mt-3 block text-xl text-emerald-600">● Automático</strong>
            <span className="mt-1 block text-xs font-bold text-slate-400">4 execuções por dia</span>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Última verificação</p>
            <strong className="mt-3 block text-base text-slate-950">{formatarData(ultimaVerificacao)}</strong>
          </div>
        </div>

        {erros.length > 0 && (
          <section className="mt-8 rounded-3xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Diagnóstico</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Produtos com falha de consulta</h2>
              <p className="mt-2 text-sm text-slate-500">
                Essas falhas ficam registradas para correção técnica. Nenhum preço inválido é publicado.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {erros.map((produto) => (
                <article key={produto.id} className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="text-slate-900">{produto.nome}</strong>
                    <p className="mt-1 text-sm font-bold text-red-700">{produto.monitor_erro}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatarData(produto.monitor_erro_em)} · {produto.monitor_falhas_consecutivas ?? 0} falha(s) consecutiva(s)
                    </p>
                  </div>
                  <a href={produto.link || "#"} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-slate-700">
                    Abrir produto ↗
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Histórico automático</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Últimos preços atualizados</h2>
              <p className="mt-2 text-sm text-slate-500">Não há aprovação manual: alterações válidas são aplicadas pelo robô.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              {alteracoes.length} recentes
            </span>
          </div>

          {alteracoes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              Nenhuma alteração recente de preço.
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {alteracoes.map((alteracao) => {
                const produtoRelacionado = Array.isArray(alteracao.produtos)
                  ? alteracao.produtos[0]
                  : alteracao.produtos;

                return (
                  <article key={alteracao.id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center">
                    <div className="h-16 w-16 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {produtoRelacionado?.imagem ? (
                        <img src={produtoRelacionado.imagem} alt={produtoRelacionado.nome || "Produto"} className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                    <div>
                      <strong className="text-slate-950">{produtoRelacionado?.nome ?? `Produto ${alteracao.produto_id}`}</strong>
                      <p className="mt-1 text-sm text-slate-500">Atualizado automaticamente em {formatarData(alteracao.aprovado_em || alteracao.criado_em)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-sm text-slate-400 line-through">{formatarPreco(alteracao.valor_antigo)}</span>
                      <strong className="ml-3 text-lg text-emerald-600">{formatarPreco(alteracao.valor_novo)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
