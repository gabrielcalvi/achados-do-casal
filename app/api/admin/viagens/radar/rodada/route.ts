import {
  NextRequest,
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_ORIGIN = "https://achadosdocasal.com.br";
const LIMITE_MENSAL_IGNAV = 12000;

const ROTAS = [
  { slug: "poa-orlando", limite: 1, origem: "POA", destino: "ORL" },
  { slug: "poa-new-york", limite: 1, origem: "POA", destino: "NYC" },
  { slug: "poa-miami", limite: 1, origem: "POA", destino: "MIA" },
  { slug: "poa-los-angeles", limite: 1, origem: "POA", destino: "LAX" },
  { slug: "poa-lisboa", limite: 1, origem: "POA", destino: "LIS" },

  { slug: "gru-orlando", limite: 1, origem: "GRU", destino: "ORL" },
  { slug: "gru-new-york", limite: 1, origem: "GRU", destino: "NYC" },
  { slug: "gru-miami", limite: 1, origem: "GRU", destino: "MIA" },
  { slug: "gru-los-angeles", limite: 1, origem: "GRU", destino: "LAX" },
  { slug: "gru-lisboa", limite: 1, origem: "GRU", destino: "LIS" },
  { slug: "gru-madrid", limite: 1, origem: "GRU", destino: "MAD" },

  { slug: "gig-orlando", limite: 1, origem: "GIG", destino: "ORL" },
  { slug: "gig-new-york", limite: 1, origem: "GIG", destino: "NYC" },
  { slug: "gig-miami", limite: 1, origem: "GIG", destino: "MIA" },
  { slug: "gig-los-angeles", limite: 1, origem: "GIG", destino: "LAX" },
  { slug: "gig-lisboa", limite: 1, origem: "GIG", destino: "LIS" },
] as const;

function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim();

  if (!segredo) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function reservarChamada(rota: (typeof ROTAS)[number]) {
  const { data, error } = await supabaseAdmin.rpc("reservar_chamada_ignav", {
    p_limite: LIMITE_MENSAL_IGNAV,
    p_camada: "radar_principal",
    p_rota: rota.slug,
    p_origem: rota.origem,
    p_destino: rota.destino,
  });

  if (error) {
    throw new Error(`Falha ao controlar orçamento Ignav: ${error.message}`);
  }

  return data !== null && data !== undefined;
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
  let limiteMensalAtingido = false;

  for (const rota of ROTAS) {
    let reservado = false;

    try {
      reservado = await reservarChamada(rota);
    } catch (erro) {
      const resultado = {
        slug: rota.slug,
        limite: rota.limite,
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      };
      console.error("[Radar rodada]", JSON.stringify(resultado));
      resultados.push(resultado);
      continue;
    }

    if (!reservado) {
      limiteMensalAtingido = true;
      resultados.push({
        slug: rota.slug,
        limite: rota.limite,
        sucesso: false,
        limiteMensalAtingido: true,
        detalhe: `Limite interno de ${LIMITE_MENSAL_IGNAV} chamadas mensais atingido.`,
      });
      break;
    }

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

  const sucesso = !limiteMensalAtingido && resultados.every((item) => item.sucesso === true);

  console.log(
    "[Radar rodada] resumo",
    JSON.stringify({
      sucesso,
      limiteMensalIgnav: LIMITE_MENSAL_IGNAV,
      limiteMensalAtingido,
      consultas_planejadas: ROTAS.length,
      consultas_realizadas: consultas,
      radares: resultados,
    })
  );

  return NextResponse.json(
    {
      sucesso,
      limiteMensalIgnav: LIMITE_MENSAL_IGNAV,
      limiteMensalAtingido,
      consultas_planejadas: ROTAS.length,
      consultas_realizadas: consultas,
      radares: resultados,
      executadoEm: new Date().toISOString(),
    },
    { status: limiteMensalAtingido ? 429 : sucesso ? 200 : 207 }
  );
}
