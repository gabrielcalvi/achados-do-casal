"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OfertaNikeAdmin = {
  id: string;
  status: string;
  titulo: string;
  categoria: string | null;
  imagem_url: string | null;
  link_destino: string | null;
  link_afiliado: string | null;
  preco_original: number | null;
  preco_oferta: number | null;
  desconto_percentual: number | null;
  origem: string | null;
  validade: string | null;
  verificado_em: string | null;
  updated_at: string | null;
  auditoria: {
    afiliadoOk: boolean;
    advertiserId: string | null;
    publisherId: string | null;
    destino: string | null;
  };
  cliques: {
    total: number;
    ultimo: string | null;
    origens: Record<string, number>;
  };
  compartilhavel: string;
  whatsapp: string;
  telegram: string;
};

type Resposta = {
  advertiserId?: string;
  publisherId?: string;
  ofertas?: OfertaNikeAdmin[];
  resumo?: {
    total: number;
    ativos: number;
    afiliadoOk: number;
    cliques: number;
  };
  error?: string;
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function data(valor: string | null) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function copiar(texto: string, mensagem: string) {
  await navigator.clipboard.writeText(texto);
  alert(mensagem);
}

export default function AdminNikeAwinPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "pendentes" | "erro-afiliado">("todos");

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch("/api/admin/economize/nike/auditoria", {
        cache: "no-store",
      });
      const json = (await resposta.json()) as Resposta;
      if (!resposta.ok) throw new Error(json.error || "Falha ao carregar auditoria Nike.");
      setDados(json);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const ofertas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (dados?.ofertas || []).filter((oferta) => {
      const correspondeBusca =
        !termo ||
        oferta.titulo.toLowerCase().includes(termo) ||
        String(oferta.categoria || "").toLowerCase().includes(termo);

      const correspondeFiltro =
        filtro === "todos" ||
        (filtro === "ativos" && oferta.status === "ativo") ||
        (filtro === "pendentes" && oferta.status === "pendente") ||
        (filtro === "erro-afiliado" && !oferta.auditoria.afiliadoOk);

      return correspondeBusca && correspondeFiltro;
    });
  }, [dados, busca, filtro]);

  const resumo = dados?.resumo || { total: 0, ativos: 0, afiliadoOk: 0, cliques: 0 };
  const tudoOk = resumo.total > 0 && resumo.afiliadoOk === resumo.total;

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl bg-black text-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-400">Achados do Casal · Auditoria AWIN</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">NIKE / AWIN</h1>
              <p className="mt-3 max-w-3xl text-zinc-300">
                Confira afiliado, preços, origem, links compartilháveis e cliques antes de divulgar.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/nike" target="_blank" className="rounded-xl bg-white px-4 py-3 font-black text-black hover:bg-zinc-200">
                Ver vitrine Nike
              </Link>
              <Link href="/admin/economize" className="rounded-xl border border-white/30 px-4 py-3 font-black text-white hover:bg-white/10">
                ← Central Economize
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Ofertas</p>
            <p className="mt-2 text-3xl font-black">{resumo.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Ativas</p>
            <p className="mt-2 text-3xl font-black">{resumo.ativos}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Afiliado validado</p>
            <p className={`mt-2 text-3xl font-black ${tudoOk ? "text-emerald-600" : "text-amber-600"}`}>
              {resumo.afiliadoOk}/{resumo.total}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Cliques registrados</p>
            <p className="mt-2 text-3xl font-black">{resumo.cliques}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Validação principal</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-black">
                <span className="rounded-full bg-slate-950 px-3 py-2 text-white">Advertiser: {dados?.advertiserId || "17652"}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-2 text-emerald-800">Publisher: {dados?.publisherId || "2922231"}</span>
                <span className={`rounded-full px-3 py-2 ${tudoOk ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {tudoOk ? "✓ Todos os links conferem" : "⚠ Existem links para revisar"}
                </span>
              </div>
            </div>
            <button onClick={carregar} className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white hover:bg-slate-800">
              Atualizar auditoria
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou categoria..."
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-black"
            />
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as typeof filtro)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="pendentes">Pendentes</option>
              <option value="erro-afiliado">Erro de afiliado</option>
            </select>
          </div>
        </section>

        {carregando ? (
          <div className="mt-6 rounded-3xl bg-white p-12 text-center font-black shadow-sm">Carregando auditoria Nike...</div>
        ) : erro ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
            <p className="font-black">Não foi possível carregar.</p>
            <p className="mt-2">{erro}</p>
          </div>
        ) : (
          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            {ofertas.map((oferta) => (
              <article key={oferta.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid sm:grid-cols-[180px_1fr]">
                  <div className="flex min-h-[180px] items-center justify-center bg-slate-50 p-4">
                    {oferta.imagem_url ? <img src={oferta.imagem_url} alt={oferta.titulo} className="max-h-44 w-full object-contain" /> : null}
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${oferta.status === "ativo" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {oferta.status.toUpperCase()}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${oferta.auditoria.afiliadoOk ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {oferta.auditoria.afiliadoOk ? "✓ AFILIADO OK" : "⚠ REVISAR AFILIADO"}
                      </span>
                      {oferta.desconto_percentual !== null ? (
                        <span className="rounded-full bg-black px-3 py-1 text-xs font-black text-white">-{Math.round(Number(oferta.desconto_percentual))}%</span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 text-xl font-black leading-6">{oferta.titulo}</h2>
                    <p className="mt-2 text-sm text-slate-500">{oferta.categoria || "Sem categoria"}</p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">Preço</p>
                        <p className="mt-1 text-lg font-black">{moeda(oferta.preco_oferta)}</p>
                        {oferta.preco_original ? <p className="text-xs text-slate-400 line-through">{moeda(oferta.preco_original)}</p> : null}
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold text-slate-500">Cliques</p>
                        <p className="mt-1 text-lg font-black">{oferta.cliques.total}</p>
                        <p className="text-xs text-slate-400">Último: {data(oferta.cliques.ultimo)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3 text-xs">
                      <p className="font-black text-slate-500">AWIN</p>
                      <p className="mt-1 break-all">mid: <strong>{oferta.auditoria.advertiserId || "—"}</strong></p>
                      <p>affid: <strong>{oferta.auditoria.publisherId || "—"}</strong></p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-xs">
                      <p className="font-black text-slate-500">Origem / atualização</p>
                      <p className="mt-1 break-all">{oferta.origem || "—"}</p>
                      <p>{data(oferta.verificado_em || oferta.updated_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={oferta.compartilhavel} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-black px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
                      Ver produto no site
                    </a>
                    <a href={`/oferta/${oferta.id}?origem=admin`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700">
                      Testar afiliado
                    </a>
                    <button onClick={() => copiar(oferta.whatsapp, "Link de WhatsApp copiado!")} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-black text-white hover:bg-green-700">
                      Copiar WhatsApp
                    </button>
                    <button onClick={() => copiar(oferta.telegram, "Link de Telegram copiado!")} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white hover:bg-sky-600">
                      Copiar Telegram
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    {Object.entries(oferta.cliques.origens).map(([origem, total]) => (
                      <span key={origem} className="rounded-full bg-slate-100 px-3 py-1">{origem}: {total}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
