"use client";

import { useEffect } from "react";

const MARCADOR = "__ML_APLICAR__";

function definirValorReact(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function MlV2AplicarSemCodigo() {
  useEffect(() => {
    let cancelado = false;
    let observador: MutationObserver | null = null;

    async function aplicar() {
      try {
        const resposta = await fetch("/api/admin/economize/cupons/ml-v2/candidatos", { cache: "no-store" });
        const dados = (await resposta.json()) as {
          sucesso?: boolean;
          candidatos?: Array<{ id: string; acao?: string | null; status?: string | null }>;
        };
        if (!resposta.ok || !dados.sucesso || cancelado) return;

        const ids = new Set(
          (dados.candidatos || [])
            .filter((item) => item.status === "aprovado" && String(item.acao || "").toLowerCase() === "aplicar")
            .map((item) => item.id),
        );

        const ajustar = () => {
          for (const id of ids) {
            const artigo = document.getElementById(`afiliado-${id}`);
            if (!artigo) continue;
            const input = artigo.querySelector('input[placeholder="Ex.: DESCONTO15"]') as HTMLInputElement | null;
            if (!input) continue;
            if (input.value !== MARCADOR) definirValorReact(input, MARCADOR);
            const label = input.closest("label") as HTMLElement | null;
            if (label) {
              label.style.display = "none";
              label.setAttribute("aria-hidden", "true");
            }
          }
        };

        ajustar();
        observador = new MutationObserver(ajustar);
        observador.observe(document.body, { childList: true, subtree: true });
      } catch {
        // Compatibilidade visual; o fluxo principal continua protegido pelo backend.
      }
    }

    void aplicar();
    return () => {
      cancelado = true;
      observador?.disconnect();
    };
  }, []);

  return null;
}
