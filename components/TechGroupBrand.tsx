type Props = {
  compact?: boolean;
};

export default function TechGroupBrand({ compact = false }: Props) {
  return (
    <div className={`rounded-3xl border border-orange-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white shadow-xl ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 shadow-inner">
          <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
            <rect x="10" y="13" width="44" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="3" className="text-cyan-300" />
            <path d="M24 51h16M20 56h24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-cyan-300" />
            <path d="M21 25h8l4-6 6 13 4-7h6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Achados do Casal</p>
          <h3 className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-black leading-tight`}>Informática & Tecnologia</h3>
          <p className="mt-1 text-sm text-slate-300">Ofertas, cupons e achados tech selecionados.</p>
        </div>
      </div>
    </div>
  );
}
