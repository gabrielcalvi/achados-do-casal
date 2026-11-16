"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Parceiro = {
  slug: string;
  nome: string;
  href: string;
  tema: string;
  quantidade: number;
};

type RespostaParceiros = {
  parceiros?: Parceiro[];
};

const estilos: Record<string, string> = {
  kabum: "bg-[#ff6500] text-white hover:bg-[#e65c00]",
  cea: "bg-[#e30613] text-white hover:bg-[#c5000c]",
  cobasi: "bg-[#0f766e] text-white hover:bg-[#0b5f59]",
  nike:
    "border border-white/30 bg-white/10 text-white hover:bg-white hover:text-black",
  renner: "bg-[#d71920] text-white hover:bg-[#b9151a]",
  "casas-bahia": "bg-[#163f8c] text-white hover:bg-[#123574]",
  kappesberg: "bg-[#7c2d12] text-white hover:bg-[#65240f]",
};

export default function PartnerPromoBar() {
  const pathname = usePathname();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  useEffect(() => {
    let ativo = true;

    async function carregarParceiros() {
      try {
        const resposta = await fetch("/api/parceiros/destaques", {
          cache: "no-store",
        });
        if (!resposta.ok) return;

        const dados = (await resposta.json()) as RespostaParceiros;
        if (ativo) setParceiros((dados.parceiros ?? []).slice(0, 6));
      } catch {
        // A barra permanece oculta quando não há destaques carregados.
      }
    }

    void carregarParceiros();
    return () => {
      ativo = false;
    };
  }, []);

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/viagens")
  ) {
    return null;
  }

  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-5 py-2.5 text-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {parceiros.map((parceiro) => (
          <Link
            key={parceiro.slug}
            href={parceiro.href}
            title={`${parceiro.quantidade} oferta${parceiro.quantidade === 1 ? "" : "s"} ativa${parceiro.quantidade === 1 ? "" : "s"}`}
            className={`inline-flex shrink-0 items-center rounded-full px-5 py-2 text-sm font-black uppercase tracking-[0.1em] transition ${
              estilos[parceiro.tema] ??
              "border border-white/30 bg-white/10 text-white hover:bg-white hover:text-black"
            }`}
          >
            {parceiro.nome} · {parceiro.quantidade}
          </Link>
        ))}
      </div>
    </div>
  );
}
