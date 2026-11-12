import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHAVE = "lri-8f6c71d2c9b1a46e";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== CHAVE) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  const token = process.env.AWIN_API_TOKEN?.trim();
  const publisher = process.env.AWIN_PUBLISHER_ID?.trim() || "2922231";

  if (!token) {
    return NextResponse.json({ erro: "AWIN_API_TOKEN ausente." }, { status: 500 });
  }

  const url = new URL(`https://api.awin.com/publishers/${publisher}/programmes`);
  url.searchParams.set("relationship", "joined");
  url.searchParams.set("includeHidden", "true");
  url.searchParams.set("accessToken", token);

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const texto = await resposta.text();
  let dados: any = null;

  try {
    dados = JSON.parse(texto);
  } catch {
    return NextResponse.json(
      { erro: "Resposta Awin invalida.", status: resposta.status },
      { status: 502 }
    );
  }

  if (!resposta.ok) {
    return NextResponse.json(
      { erro: "Awin recusou a consulta.", status: resposta.status },
      { status: 502 }
    );
  }

  const lista = Array.isArray(dados) ? dados : Array.isArray(dados?.programmes) ? dados.programmes : [];
  const matches = lista
    .filter((item: any) => {
      const textoBusca = [
        item?.name,
        item?.displayUrl,
        ...(Array.isArray(item?.validDomains) ? item.validDomains.map((x: any) => x?.domain) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return textoBusca.includes("lauri") || textoBusca.includes("lauriesporte");
    })
    .map((item: any) => ({
      id: item?.id ?? null,
      name: item?.name ?? null,
      displayUrl: item?.displayUrl ?? null,
      logoUrl: item?.logoUrl ?? null,
      status: item?.status ?? null,
      validDomains: item?.validDomains ?? null,
    }));

  return NextResponse.json({ publisher, matches });
}
