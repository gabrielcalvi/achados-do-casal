import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

function formatarPreco(valor: string | null) {
  if (!valor) return "—";

  const numero = Number(valor);

  if (!Number.isFinite(numero)) return valor;

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
  ] = await Promise.all([
    supabaseAdmin
      .from("produtos")
      .select("id", {
        count: "exact",
        head: true,
      })
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
        produtos (
          nome,
          imagem,
          link
        )
      `)
      .eq("status", "pendente")
      .order("criado_em", {
        ascending: false,
      }),

    supabaseAdmin
      .from("produtos")
      .select("ultima_verificacao")
      .not("ultima_verificacao", "is", null)
      .order("ultima_verificacao", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
  ]);

  const alteracoesBrutas =
    alteracoesResponse.data ?? [];

  /*
   * Enquanto corrigimos os registros duplicados no monitor,
   * mostramos apenas a alteração pendente mais recente de
   * cada produto e tipo.
   */
  const alteracoesUnicas = Array.from(
    new Map(
      alteracoesBrutas.map((alteracao) => [
        `${alteracao.produto_id}-${alteracao.tipo}`,
        alteracao,
      ])
    ).values()
  );

  const totalProdutos =
    produtosResponse.count ?? 0;

  const totalPendentes =
    alteracoesUnicas.length;

  const ultimaVerificacao =
    ultimaVerificacaoResponse.data
      ?.ultima_verificacao ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: "48px 64px",
      }}
    >
      <section
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            color: "#ff2b87",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          ACHADOS DO CASAL
        </p>

        <h1
          style={{
            fontSize: "42px",
            margin: 0,
            color: "#0a1633",
          }}
        >
          Monitor de preços
        </h1>

        <p
          style={{
            color: "#526078",
            marginTop: "10px",
            fontSize: "17px",
          }}
        >
          Acompanhe alterações encontradas nos produtos monitorados.
        </p>

        <nav
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "28px",
          }}
        >
          <Link
            href="/admin"
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              background: "#ffffff",
              color: "#16275c",
              textDecoration: "none",
              fontWeight: 700,
              border: "1px solid #dce3ee",
            }}
          >
            Produtos
          </Link>

          <Link
            href="/admin/monitor"
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              background: "#16275c",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Monitor
          </Link>
        </nav>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginTop: "28px",
          }}
        >
          <div style={cardStyle}>
            <span style={labelStyle}>
              Produtos monitorados
            </span>

            <strong style={valueStyle}>
              {totalProdutos}
            </strong>
          </div>

          <div style={cardStyle}>
            <span style={labelStyle}>
              Alterações pendentes
            </span>

            <strong
              style={{
                ...valueStyle,
                color: "#dc2626",
              }}
            >
              {totalPendentes}
            </strong>
          </div>

          <div style={cardStyle}>
            <span style={labelStyle}>
              Status do monitor
            </span>

            <strong
              style={{
                fontSize: "20px",
                color: "#16a34a",
                marginTop: "14px",
              }}
            >
              ● Funcionando
            </strong>
          </div>

          <div style={cardStyle}>
            <span style={labelStyle}>
              Última verificação
            </span>

            <strong
              style={{
                fontSize: "18px",
                color: "#0a1633",
                marginTop: "14px",
              }}
            >
              {formatarData(
                ultimaVerificacao
              )}
            </strong>
          </div>
        </div>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "22px",
            marginTop: "32px",
            padding: "32px",
            boxShadow:
              "0 10px 30px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: "#0a1633",
                  fontSize: "28px",
                }}
              >
                Alterações encontradas
              </h2>

              <p
                style={{
                  color: "#64748b",
                  marginTop: "8px",
                }}
              >
                Revise cada mudança antes de atualizar o produto.
              </p>
            </div>

            <span
              style={{
                background:
                  totalPendentes > 0
                    ? "#fee2e2"
                    : "#dcfce7",
                color:
                  totalPendentes > 0
                    ? "#b91c1c"
                    : "#15803d",
                padding: "10px 14px",
                borderRadius: "999px",
                fontWeight: 700,
              }}
            >
              {totalPendentes} pendente
              {totalPendentes === 1
                ? ""
                : "s"}
            </span>
          </div>

          {alteracoesUnicas.length === 0 ? (
            <div
              style={{
                marginTop: "28px",
                border: "1px dashed #cbd5e1",
                borderRadius: "18px",
                padding: "34px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Nenhuma alteração pendente.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "16px",
                marginTop: "28px",
              }}
            >
              {alteracoesUnicas.map(
                (alteracao) => {
                  const produtoRelacionado =
                    Array.isArray(
                      alteracao.produtos
                    )
                      ? alteracao.produtos[0]
                      : alteracao.produtos;

                  return (
                    <article
                      key={alteracao.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "72px minmax(220px, 1fr) 180px 50px 180px 150px",
                        alignItems: "center",
                        gap: "18px",
                        border:
                          "1px solid #e2e8f0",
                        borderRadius: "18px",
                        padding: "18px",
                      }}
                    >
                      <div
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "14px",
                          background: "#f8fafc",
                          border:
                            "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "center",
                          overflow: "hidden",
                        }}
                      >
                        {produtoRelacionado?.imagem ? (
                          <img
                            src={
                              produtoRelacionado.imagem
                            }
                            alt={
                              produtoRelacionado.nome
                            }
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>

                      <div>
                        <strong
                          style={{
                            color: "#0a1633",
                            fontSize: "17px",
                          }}
                        >
                          {produtoRelacionado?.nome ??
                            `Produto ${alteracao.produto_id}`}
                        </strong>

                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              background:
                                "#fee2e2",
                              color: "#b91c1c",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "999px",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            Preço alterado
                          </span>

                          <span
                            style={{
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            {formatarData(
                              alteracao.criado_em
                            )}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span
                          style={smallLabelStyle}
                        >
                          Preço publicado
                        </span>

                        <strong
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: "#64748b",
                            fontSize: "18px",
                            textDecoration:
                              "line-through",
                          }}
                        >
                          {formatarPreco(
                            alteracao.valor_antigo
                          )}
                        </strong>
                      </div>

                      <div
                        style={{
                          textAlign: "center",
                          color: "#64748b",
                          fontSize: "24px",
                        }}
                      >
                        →
                      </div>

                      <div>
                        <span
                          style={smallLabelStyle}
                        >
                          Preço encontrado
                        </span>

                        <strong
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: "#16a34a",
                            fontSize: "22px",
                          }}
                        >
                          {formatarPreco(
                            alteracao.valor_novo
                          )}
                        </strong>
                      </div>

                     <Link
  href={`/admin/monitor/${alteracao.id}`}
  style={{
    background: "#16275c",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "13px 16px",
    fontWeight: 700,
    textDecoration: "none",
    textAlign: "center",
  }}
>
  Revisar
</Link>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const cardStyle = {
  background: "#ffffff",
  borderRadius: "20px",
  padding: "24px",
  minHeight: "120px",
  display: "flex",
  flexDirection: "column" as const,
  boxShadow:
    "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const labelStyle = {
  color: "#64748b",
  fontSize: "15px",
};

const valueStyle = {
  fontSize: "34px",
  color: "#0a1633",
  marginTop: "12px",
};

const smallLabelStyle = {
  color: "#64748b",
  fontSize: "13px",
};