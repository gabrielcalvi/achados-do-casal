import AcoesAlteracao from "./AcoesAlteracao";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RevisarAlteracaoPage({
  params,
}: Props) {
  const { id } = await params;

  const { data: alteracao } = await supabaseAdmin
    .from("monitor_alteracoes")
    .select(`
      *,
      produtos (
        id,
        nome,
        imagem,
        link,
        loja
      )
    `)
    .eq("id", id)
    .single();

  if (!alteracao) {
    notFound();
  }
return (
  <main
    style={{
      minHeight: "100vh",
      background: "#f4f7fb",
      padding: "48px 64px",
    }}
  >
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin/monitor"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          color: "#16275c",
          fontWeight: 700,
          textDecoration: "none",
          marginBottom: "28px",
        }}
      >
        ← Voltar ao monitor
      </Link>

      <p
        style={{
          color: "#ff2b87",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        ACHADOS DO CASAL
      </p>

      <h1
        style={{
          fontSize: 40,
          margin: 0,
          color: "#0a1633",
        }}
      >
        Revisar alteração
      </h1>

      <p
        style={{
          color: "#526078",
          marginTop: 10,
        }}
      >
        Confira os dados encontrados antes de aprovar.
      </p>

      <section
        style={{
          marginTop: "32px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: "28px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "180px",
              height: "180px",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {alteracao.produtos?.imagem ? (
              <img
                src={alteracao.produtos.imagem}
                alt={alteracao.produtos.nome}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span style={{ fontSize: "42px" }}>📦</span>
            )}
          </div>

          <div>
            <span
              style={{
                display: "inline-block",
                background: "#fee2e2",
                color: "#b91c1c",
                padding: "7px 12px",
                borderRadius: "999px",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              Preço alterado
            </span>

            <h2
              style={{
                fontSize: "28px",
                margin: "16px 0 0",
                color: "#0a1633",
              }}
            >
              {alteracao.produtos?.nome}
            </h2>

            <p
              style={{
                marginTop: "8px",
                color: "#64748b",
              }}
            >
              {alteracao.produtos?.loja}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 1fr",
            gap: "24px",
            alignItems: "center",
            marginTop: "36px",
            padding: "28px",
            borderRadius: "20px",
            background: "#f8fafc",
          }}
        >
          <div>
            <span
              style={{
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Preço publicado
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "8px",
                fontSize: "30px",
                color: "#dc2626",
                textDecoration: "line-through",
              }}
            >
              {Number(alteracao.valor_antigo).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: "34px",
              color: "#64748b",
            }}
          >
            →
          </div>

          <div>
            <span
              style={{
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Preço encontrado
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "8px",
                fontSize: "34px",
                color: "#16a34a",
              }}
            >
              {Number(alteracao.valor_novo).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>
        </div>
<AcoesAlteracao
  alteracaoId={alteracao.id}
  linkProduto={alteracao.produtos?.link}
/>        
      </section>
    </div>
  </main>
);
}