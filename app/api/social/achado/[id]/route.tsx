import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LARGURA = 1200;
const ALTURA = 630;

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

async function imagemSegura(url: string | null) {
  if (!url) return null;

  try {
    const resposta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!resposta.ok) return null;

    const tipo = resposta.headers.get("content-type") || "image/jpeg";
    if (!tipo.startsWith("image/")) return null;

    const buffer = Buffer.from(await resposta.arrayBuffer());
    if (buffer.byteLength > 4_500_000) return null;

    return `data:${tipo};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agora = new Date().toISOString();

  const { data: oferta } = await supabaseAdmin
    .from("economize_ofertas")
    .select(`
      id,
      titulo,
      imagem_url,
      desconto_percentual,
      preco_original,
      preco_oferta,
      loja:economize_lojas!inner (
        nome,
        ativa
      )
    `)
    .eq("id", id)
    .eq("status", "ativo")
    .eq("economize_lojas.ativa", true)
    .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
    .or(`validade.is.null,validade.gt.${agora}`)
    .maybeSingle();

  if (!oferta) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "white",
            fontSize: 54,
            fontWeight: 900,
          }}
        >
          Achados do Casal
        </div>
      ),
      { width: LARGURA, height: ALTURA }
    );
  }

  const lojaRelacionada = Array.isArray(oferta.loja)
    ? oferta.loja[0]
    : oferta.loja;
  const loja = lojaRelacionada?.nome || "Loja parceira";
  const preco = moeda(oferta.preco_oferta);
  const precoOriginal = moeda(oferta.preco_original);
  const desconto = Number(oferta.desconto_percentual) || 0;
  const produtoImagem = await imagemSegura(oferta.imagem_url);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
          padding: 42,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            overflow: "hidden",
            borderRadius: 34,
            border: "2px solid #e2e8f0",
            background: "white",
          }}
        >
          <div
            style={{
              width: 490,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background: "#f8fafc",
              padding: 34,
            }}
          >
            {desconto > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  top: 28,
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "#0f172a",
                  color: "white",
                  fontSize: 28,
                  fontWeight: 900,
                }}
              >
                -{Math.round(desconto)}%
              </div>
            ) : null}

            {produtoImagem ? (
              <img
                src={produtoImagem}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 300,
                  height: 300,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  fontSize: 92,
                }}
              >
                🔥
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "40px 44px 34px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 25,
                  fontWeight: 900,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    background: "#0f172a",
                    color: "white",
                    fontSize: 23,
                  }}
                >
                  A
                </span>
                ACHADOS DO CASAL
              </div>

              <div
                style={{
                  display: "flex",
                  padding: "9px 15px",
                  borderRadius: 999,
                  background: "#dcfce7",
                  color: "#166534",
                  fontSize: 21,
                  fontWeight: 800,
                }}
              >
                {loja}
              </div>
            </div>

            <div
              style={{
                marginTop: 34,
                display: "flex",
                fontSize: 41,
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: "-1.1px",
                maxHeight: 190,
                overflow: "hidden",
              }}
            >
              {oferta.titulo}
            </div>

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {precoOriginal && oferta.preco_original && oferta.preco_oferta && Number(oferta.preco_original) > Number(oferta.preco_oferta) ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 24,
                    color: "#94a3b8",
                    textDecoration: "line-through",
                  }}
                >
                  {precoOriginal}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 56,
                    fontWeight: 900,
                    letterSpacing: "-1.4px",
                  }}
                >
                  {preco || "Confira a condição"}
                </div>
                {desconto > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      color: "#059669",
                      fontSize: 25,
                      fontWeight: 900,
                    }}
                  >
                    economize {Math.round(desconto)}%
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: 18,
                  color: "#64748b",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                <span>achadosdocasal.com.br</span>
                <span>Preço e disponibilidade podem mudar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: LARGURA,
      height: ALTURA,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=1800",
      },
    }
  );
}
