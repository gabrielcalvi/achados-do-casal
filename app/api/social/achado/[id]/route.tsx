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
  const temPrecoAnterior = Boolean(
    precoOriginal &&
      oferta.preco_original &&
      oferta.preco_oferta &&
      Number(oferta.preco_original) > Number(oferta.preco_oferta)
  );
  const produtoImagem = await imagemSegura(oferta.imagem_url);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#e2e8f0",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
          padding: 28,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            overflow: "hidden",
            borderRadius: 34,
            background: "white",
            boxShadow: "0 14px 34px rgba(15,23,42,0.14)",
          }}
        >
          <div
            style={{
              width: 650,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background: "#ffffff",
              padding: 38,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 28,
                top: 26,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 999,
                background: "#0f172a",
                color: "white",
                fontSize: 19,
                fontWeight: 900,
                letterSpacing: "0.5px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  width: 28,
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                A
              </span>
              ACHADOS DO CASAL
            </div>

            {produtoImagem ? (
              <img
                src={produtoImagem}
                alt=""
                style={{
                  width: "94%",
                  height: "86%",
                  marginTop: 36,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 330,
                  height: 330,
                  borderRadius: 999,
                  background: "#f1f5f9",
                  fontSize: 110,
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
              justifyContent: "space-between",
              background: "#0f172a",
              color: "white",
              padding: "42px 42px 34px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  padding: "9px 15px",
                  borderRadius: 999,
                  background: "#facc15",
                  color: "#0f172a",
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                ACHADO
              </div>

              <div
                style={{
                  display: "flex",
                  maxWidth: 260,
                  padding: "9px 15px",
                  borderRadius: 999,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  fontSize: 19,
                  fontWeight: 800,
                  overflow: "hidden",
                }}
              >
                {loja}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                paddingTop: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#94a3b8",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                OFERTA ENCONTRADA
              </div>

              {temPrecoAnterior ? (
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    color: "#94a3b8",
                    fontSize: 27,
                    textDecoration: "line-through",
                  }}
                >
                  {precoOriginal}
                </div>
              ) : null}

              <div
                style={{
                  marginTop: temPrecoAnterior ? 4 : 18,
                  display: "flex",
                  fontSize: preco ? 72 : 45,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  whiteSpace: "nowrap",
                }}
              >
                {preco || "CONFIRA A OFERTA"}
              </div>

              {desconto > 0 ? (
                <div
                  style={{
                    marginTop: 22,
                    display: "flex",
                    alignSelf: "flex-start",
                    padding: "10px 16px",
                    borderRadius: 14,
                    background: "#dcfce7",
                    color: "#166534",
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  {Math.round(desconto)}% OFF
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 22,
                    display: "flex",
                    color: "#cbd5e1",
                    fontSize: 23,
                    fontWeight: 700,
                  }}
                >
                  Veja preço e disponibilidade
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #334155",
                paddingTop: 18,
                color: "#cbd5e1",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              <span>achadosdocasal.com.br</span>
              <span>Confira antes que mude</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: LARGURA,
      height: ALTURA,
      headers: {
        "Cache-Control": "public, max-age=120, s-maxage=900",
      },
    }
  );
}
