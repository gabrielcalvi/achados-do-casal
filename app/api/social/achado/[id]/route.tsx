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
            color: "#ffffff",
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
            border: "2px solid #cbd5e1",
            background: "#ffffff",
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
              padding: 36,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 26,
                top: 24,
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                borderRadius: 999,
                background: "#0f172a",
                color: "#ffffff",
                fontSize: 19,
                fontWeight: 900,
              }}
            >
              ACHADOS DO CASAL
            </div>

            {produtoImagem ? (
              <img
                src={produtoImagem}
                alt=""
                style={{
                  width: "94%",
                  height: "84%",
                  marginTop: 38,
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
              background: "#0f172a",
              color: "#ffffff",
              padding: "38px 40px 32px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
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
                  padding: "9px 15px",
                  borderRadius: 999,
                  background: "#1e293b",
                  color: "#e2e8f0",
                  fontSize: 19,
                  fontWeight: 800,
                }}
              >
                {loja}
              </div>
            </div>

            <div
              style={{
                marginTop: 58,
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
                  marginTop: 20,
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
                marginTop: temPrecoAnterior ? 4 : 24,
                display: "flex",
                fontSize: preco ? 68 : 43,
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-2px",
              }}
            >
              {preco || "CONFIRA A OFERTA"}
            </div>

            {desconto > 0 ? (
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  width: 180,
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: "#dcfce7",
                  color: "#166534",
                  fontSize: 27,
                  fontWeight: 900,
                }}
              >
                {Math.round(desconto)}% OFF
              </div>
            ) : (
              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  color: "#cbd5e1",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                Veja preço e disponibilidade
              </div>
            )}

            <div
              style={{
                marginTop: "auto",
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
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}
