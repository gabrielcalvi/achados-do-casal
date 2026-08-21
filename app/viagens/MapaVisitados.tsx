"use client";

import { useEffect, useState } from "react";

const BRASIL_VISITADOS = new Set(["am", "ba", "df", "ms", "pb", "pe", "pr", "rj", "rs", "sc", "sp"]);
const MUNDO_VISITADOS = new Set(["ar", "br", "bs", "ca", "ch", "co", "hr", "hu", "it", "jm", "ky", "mx", "pa", "pe", "py", "si", "us", "uy"]);

const CORES_BRASIL: Record<string, string> = {
  am: "#059669",
  ba: "#f59e0b",
  df: "#7c3aed",
  ms: "#14b8a6",
  pb: "#f97316",
  pe: "#fb923c",
  pr: "#16a34a",
  rj: "#0284c7",
  rs: "#047857",
  sc: "#0d9488",
  sp: "#2563eb",
};

const CORES_MUNDO: Record<string, string> = {
  ar: "#10b981",
  br: "#22c55e",
  bs: "#ec4899",
  ca: "#0ea5e9",
  ch: "#facc15",
  co: "#16a34a",
  hr: "#fb923c",
  hu: "#f59e0b",
  it: "#fde047",
  jm: "#f472b6",
  ky: "#db2777",
  mx: "#14b8a6",
  pa: "#38bdf8",
  pe: "#34d399",
  py: "#2dd4bf",
  si: "#fbbf24",
  us: "#0284c7",
  uy: "#6ee7b7",
};

function useColoredSvg(url: string, visited: Set<string>, colors: Record<string, string>, dark = false) {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Mapa indisponível: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!active) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const root = doc.documentElement;

        root.setAttribute("width", "100%");
        root.setAttribute("height", "100%");
        root.setAttribute("preserveAspectRatio", "xMidYMid meet");
        root.removeAttribute("style");

        root.querySelectorAll("path").forEach((path) => {
          const id = (path.getAttribute("id") || "").toLowerCase();
          const isVisited = visited.has(id);
          path.setAttribute("fill", isVisited ? (colors[id] || "#14b8a6") : dark ? "#17324a" : "#dbeafe");
          path.setAttribute("stroke", dark ? "#315775" : "#ffffff");
          path.setAttribute("stroke-width", dark ? "0.55" : "1.3");
          path.style.transition = "opacity 180ms ease, filter 180ms ease";
          path.style.opacity = isVisited ? "1" : dark ? ".72" : ".88";
        });

        setSvg(new XMLSerializer().serializeToString(root));
      })
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
    };
  }, [url, visited, colors, dark]);

  return { svg, failed };
}

export function MapaBrasilVisitados() {
  const { svg, failed } = useColoredSvg(
    "https://cdn.jsdelivr.net/npm/@svg-country-maps/brazil@1.0.3/brazil.svg",
    BRASIL_VISITADOS,
    CORES_BRASIL,
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[455px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-inner backdrop-blur">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,.16),transparent_43%),linear-gradient(145deg,rgba(236,253,245,.78),rgba(224,242,254,.78))]" />
      <div className="relative flex h-full w-full items-center justify-center p-3">
        {svg ? (
          <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : failed ? (
          <img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Brazil_Blank_Map.svg" alt="Mapa do Brasil" className="h-full w-full object-contain opacity-80" />
        ) : (
          <div className="h-[78%] w-[70%] animate-pulse rounded-[35%] bg-emerald-200/60" />
        )}
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-2 text-[10px] font-black">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-emerald-800 shadow-sm">11 estados/DF destacados</span>
        <span className="rounded-full bg-slate-900/90 px-3 py-1.5 text-white shadow-sm">os demais ficam em azul claro</span>
      </div>
    </div>
  );
}

export function MapaMundoVisitados() {
  const { svg, failed } = useColoredSvg(
    "https://cdn.jsdelivr.net/npm/@svg-maps/world@2.0.0/world.svg",
    MUNDO_VISITADOS,
    CORES_MUNDO,
    true,
  );

  return (
    <div className="relative min-h-[330px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#07172c] sm:min-h-[385px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_30%,rgba(14,165,233,.16),transparent_28%),radial-gradient(circle_at_58%_30%,rgba(250,204,21,.09),transparent_25%)]" />
      <div className="relative flex h-[330px] w-full items-center justify-center p-5 sm:h-[385px]">
        {svg ? (
          <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : failed ? (
          <img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Blank_world_map_Robinson_projection.svg" alt="Mapa-múndi" className="h-full w-full object-contain opacity-55 invert" />
        ) : (
          <div className="h-[70%] w-[85%] animate-pulse rounded-[45%] bg-slate-800" />
        )}
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-2 text-[10px] font-black">
        <span className="rounded-full bg-cyan-500/90 px-3 py-1.5 text-slate-950 shadow-sm">18 visitados em cores</span>
        <span className="rounded-full bg-slate-950/80 px-3 py-1.5 text-slate-200 shadow-sm">demais países em azul escuro</span>
      </div>
    </div>
  );
}
