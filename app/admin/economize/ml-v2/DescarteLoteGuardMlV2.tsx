"use client";

import { useEffect } from "react";

function idsSelecionadosNaTabela() {
  const checkboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][aria-label^="Selecionar "]:checked'
    )
  );

  const ids = checkboxes
    .map((checkbox) => {
      const linha = checkbox.closest("tr");
      const form = linha?.querySelector<HTMLFormElement>(
        'form[action*="/api/admin/economize/cupons/ml-v2/candidatos/"]'
      );
      const action = form?.getAttribute("action") || "";
      const match = action.match(/\/candidatos\/([^/?#]+)/i);
      return match?.[1] || "";
    })
    .filter(Boolean);

  return [...new Set(ids)];
}

export default function DescarteLoteGuardMlV2() {
  useEffect(() => {
    let executando = false;

    async function aoClicar(evento: MouseEvent) {
      const alvo = evento.target;
      if (!(alvo instanceof Element)) return;

      const botao = alvo.closest<HTMLButtonElement>('button[type="submit"]');
      if (!botao || botao.textContent?.trim() !== "Descartar") return;

      const form = botao.closest("form");
      const acao = form?.querySelector<HTMLInputElement>('input[name="acao"]')?.value;
      if (acao !== "rejeitar") return;

      const ids = idsSelecionadosNaTabela();
      if (ids.length < 2) return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();

      if (executando) return;

      const confirmou = window.confirm(
        `Você marcou ${ids.length} candidatos. Descartar todos os selecionados de uma vez?`
      );
      if (!confirmou) return;

      executando = true;
      const textoOriginal = botao.textContent;
      botao.disabled = true;
      botao.textContent = `Descartando ${ids.length}...`;

      try {
        const resposta = await fetch(
          "/api/admin/economize/cupons/ml-v2/candidatos/lote",
          {
            method: "PATCH",
            cache: "no-store",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ids, acao: "descartar" }),
          }
        );

        const dados = (await resposta.json().catch(() => null)) as
          | {
              sucesso?: boolean;
              erro?: string;
              descartados?: number;
              ignorados?: number;
            }
          | null;

        if (!resposta.ok || !dados?.sucesso) {
          throw new Error(dados?.erro || "Não foi possível descartar a seleção.");
        }

        const descartados = dados.descartados ?? 0;
        const ignorados = dados.ignorados ?? 0;
        window.alert(
          ignorados > 0
            ? `${descartados} descartados. ${ignorados} foram ignorados porque já estavam publicados ou descartados.`
            : `${descartados} candidatos descartados com sucesso.`
        );
        window.location.reload();
      } catch (erro) {
        window.alert(
          erro instanceof Error ? erro.message : "Erro ao descartar em lote."
        );
        botao.disabled = false;
        botao.textContent = textoOriginal || "Descartar";
        executando = false;
      }
    }

    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  return null;
}
