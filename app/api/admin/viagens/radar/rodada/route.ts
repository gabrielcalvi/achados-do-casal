import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_ORIGIN = "https://achadosdocasal.com.br";

const ROTAS = [
  { slug: "poa-orlando", limite: 1 },
  { slug: "poa-new-york", limite: 1 },
  { slug: "poa-miami", limite: 1 },
  { slug: "poa-los-angeles", limite: 1 },
  { slug: "poa-lisboa", limite: 1 },

  { slug: "gru-orlando", limite: 1 },
  { slug: "gru-new-york", limite: 1 },
  { slug: "gru-miami", limite: 1 },
  { slug: "gru-los-angeles", limite: 1 },
  { slug: "gru-lisboa", limite: 1 },
  { slug: "gru-madrid", limite: 1 },

  { slug: "gig-orlando", limite: 1 },
  { slug: "gig-new-york", limite: 1 },
  { slug: "gig-miami", limite: 1 },
  { slug: "gig-los-angeles", limite: 1 },
  { slug: "gig-lisboa", limite: 1 },
] as const;

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  if (!segredo) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Nao autorizado.",
      },
      { status: 401 }
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const resultados: Array<Record<string, unknown>> = [];
  let consultas = 0;

  for (const rota of ROTAS) {
    const url = new URL(
      "/api/admin/viagens/radar/executar",
      SITE_ORIGIN
    );

    url.searchParams.set("slug", rota.slug);
    url.searchParams.set("limite", String(rota.limite));

    try {
      const resposta = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: authorization,
        },
      });

      const texto = await resposta.text();
      let dados: any = {};

      if (texto) {
        try {
          dados = JSON.parse(texto);
        } catch {
          dados = { texto };
        }
      }

      consultas += Number(dados?.consultas || 0);

      const resultado = {
        slug: rota.slug,
        limite: rota.limite,
        http: resposta.status,
        sucesso: resposta.ok && dados?.sucesso === true,
        consultas: Number(dados?.consultas || 0),
        gravadas: Number(dados?.observacoes_gravadas || 0),
        erros: Number(dados?.erros || 0),
        detalhe:
          dados?.erro ||
          (dados?.sucesso === true ? null : dados?.status || null),
      };

      console.log("[Radar rodada]", JSON.stringify(resultado));
      resultados.push(resultado);
    } catch (erro) {
      const resultado = {
        slug: rota.slug,
        limite: rota.limite,
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      };

      console.error("[Radar rodada]", JSON.stringify(resultado));
      resultados.push(resultado);
    }
  }

  const sucesso = resultados.every((item) => item.sucesso === true);

  console.log(
    "[Radar rodada] resumo",
    JSON.stringify({
      sucesso,
      consultas_planejadas: ROTAS.length,
      consultas_realizadas: consultas,
      radares: resultados,
    })
  );

  return NextResponse.json(
    {
      sucesso,
      consultas_planejadas: ROTAS.length,
      consultas_realizadas: consultas,
      radares: resultados,
      executadoEm: new Date().toISOString(),
    },
    { status: sucesso ? 200 : 207 }
  );
}
