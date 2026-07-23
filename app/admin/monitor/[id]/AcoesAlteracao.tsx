"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  alteracaoId: string;
  linkProduto?: string | null;
};

export default function AcoesAlteracao({
  alteracaoId,
  linkProduto,
}: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function aprovarAlteracao() {
    const confirmar = window.confirm(
      "Deseja aprovar esta alteração de preço?"
    );

    if (!confirmar) return;

    setCarregando(true);

    try {
      const resposta = await fetch(
        `/api/monitor/alteracoes/${alteracaoId}/aprovar`,
        {
          method: "POST",
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        alert(resultado.erro || "Não foi possível aprovar.");
        return;
      }

      alert("Alteração aprovada com sucesso.");
      router.push("/admin/monitor");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro ao aprovar a alteração.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        marginTop: "28px",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={aprovarAlteracao}
        disabled={carregando}
        style={{
          background: "#16a34a",
          color: "#ffffff",
          border: 0,
          borderRadius: "14px",
          padding: "15px 22px",
          fontWeight: 700,
          cursor: carregando ? "not-allowed" : "pointer",
          opacity: carregando ? 0.65 : 1,
        }}
      >
        {carregando ? "Aprovando..." : "Aprovar alteração"}
      </button>

      <button
        type="button"
        disabled
        style={{
          background: "#f59e0b",
          color: "#ffffff",
          border: 0,
          borderRadius: "14px",
          padding: "15px 22px",
          fontWeight: 700,
          cursor: "not-allowed",
          opacity: 0.6,
        }}
      >
        Ignorar
      </button>

      {linkProduto && (
        <a
          href={linkProduto}
          target="_blank"
          rel="noreferrer"
          style={{
            background: "#16275c",
            color: "#ffffff",
            borderRadius: "14px",
            padding: "15px 22px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Abrir anúncio
        </a>
      )}
    </div>
  );
}