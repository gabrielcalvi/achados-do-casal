"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TechGroupBrand from "@/components/TechGroupBrand";

type Oferta = {
  id: string;
  titulo: string;
  descricao: string | null;
  codigo: string | null;
  categoria: string | null;
  imagem_url: string | null;
  desconto_percentual: number | null;
  preco_original: number | null;
  preco_oferta: number | null;
  validade: string | null;
  tipo: string;
};

type Resposta = { ofertas?: Oferta[]; total?: number; error?: string };

const GRUPO_TECNOLOGIA = "https://chat.whatsapp.com/D4XuZWkA1zb772LTVeXjir";

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

export default function KabumPage() {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        setCarregando(true);
        setErro("");
        const resposta = await fetch("/api/economize/ofertas?loja=kabum", { cache: "no-store" });
        const dados = (await resposta.json()) as Resposta;
        if (!resposta.ok) throw new Error(dados.error || "Não foi possível carregar a KaBuM.");
        if (ativo) setOfertas(dados.ofertas || []);
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : "Erro ao carregar ofertas KaBuM.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ofertas;
    return ofertas.filter((oferta) =>
      [oferta.titulo, oferta.categoria, oferta.descricao]
        .filter(Boolean)
        .some((texto) => String(texto).toLowerCase().includes(termo)),
    );
  }, [busca, ofertas]);

  const melhor = ofertas.reduce((maior, oferta) => Math.max(maior, Number(oferta.desconto_percentual) || 0), 0);
  const comCupom = ofertas.filter((oferta) => Boolean(oferta.codigo)).length;

  return (
    <main className="min-h-screen bg-[#f4f4f5] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/"><img src="/logo-achados-do-casal.png" alt="Achados do Casal" className="h-12 w-auto" /></Link>
          <div className="flex flex-wrap gap-2">
            <a href={GRUPO_TECNOLOGIA} target="_blank" rel="noopener noreferrer" className="rounded-full bg-green-600 px-4 py-2 text-sm font-black text-white hover:bg-green-700">WhatsApp Tech</a>
            <Link href="/economize" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black">Economize</Link>
            <Link href="/" className="rounded-full bg-[#ff6500] px-4 py-2 text-sm font-black text-white">Início</Link>
          </div>
        </div>
      </header>

      <section className="bg-[#101010] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#ff8a3d]">Parceiro AWIN · seleção do Achados</p>
            <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">KaBuM!</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">Tecnologia, gamer e casa tech ordenados pelas maiores oportunidades de desconto disponíveis agora.</p>
            <a href={GRUPO_TECNOLOGIA} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-xl bg-green-600 px-5 py-3 font-black text-white transition hover:bg-green-700">💬 Entrar no grupo de Informática e Tecnologia</a>
          </div>
          <div className="space-y-3">
            <a href={GRUPO_TECNOLOGIA} target="_blank" rel="noopener noreferrer" className="block transition hover:-translate-y-0.5">
              <TechGroupBrand compact />
            </a>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs font-bold text-zinc-400">Ativas</p><p className="mt-2 text-3xl font-black">{ofertas.length}</p></div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs font-bold text-zinc-400">Com cupom</p><p className="mt-2 text-3xl font-black">{comCupom}</p></div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-xs font-bold text-zinc-400">Até</p><p className="mt-2 text-3xl font-black">{melhor > 0 ? `${Math.round(melhor)}%` : "—"}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#d95100]">Achados KaBuM</p><h2 className="mt-1 text-2xl font-black">Maiores descontos primeiro</h2></div>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar notebook, monitor, gamer..." className="h-12 w-full rounded-full border border-zinc-300 bg-zinc-50 px-5 outline-none focus:border-[#ff6500] sm:max-w-md" />
        </div>

        {carregando ? (
          <div className="mt-6 rounded-3xl bg-white p-12 text-center font-black shadow-sm">Carregando ofertas KaBuM...</div>
        ) : erro ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">{erro}</div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtradas.map((oferta) => {
              const atual = moeda(oferta.preco_oferta);
              const anterior = moeda(oferta.preco_original);
              const desconto = Number(oferta.desconto_percentual) || 0;
              return (
                <article key={oferta.id} className="group flex min-h-[470px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <Link href={`/achado/${oferta.id}`} className="relative flex h-64 items-center justify-center bg-zinc-50 p-5">
                    {desconto > 0 ? <span className="absolute left-4 top-4 rounded-full bg-[#ff6500] px-3 py-2 text-xs font-black text-white">-{Math.round(desconto)}%</span> : null}
                    {oferta.codigo ? <span className="absolute right-4 top-4 rounded-full bg-black px-3 py-2 text-[11px] font-black uppercase text-white">Cupom</span> : null}
                    {oferta.imagem_url ? <img src={oferta.imagem_url} alt={oferta.titulo} className="h-full w-full object-contain transition group-hover:scale-[1.03]" /> : null}
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#d95100]">KaBuM {oferta.categoria ? `· ${oferta.categoria}` : ""}</p>
                    <h3 className="mt-2 line-clamp-3 text-lg font-black leading-6">{oferta.titulo}</h3>
                    <div className="mt-auto pt-5">
                      {anterior && oferta.preco_original && oferta.preco_oferta && Number(oferta.preco_original) > Number(oferta.preco_oferta) ? <p className="text-sm text-zinc-400 line-through">{anterior}</p> : null}
                      <p className="mt-1 text-2xl font-black">{atual || "Ver condição"}</p>
                      {oferta.codigo ? <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-center text-xs font-black text-[#d95100]">Cupom: {oferta.codigo}</p> : null}
                      <Link href={`/achado/${oferta.id}`} className="mt-4 flex h-12 items-center justify-center rounded-full bg-[#ff6500] px-5 font-black text-white hover:bg-[#e65c00]">Ver produto</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
