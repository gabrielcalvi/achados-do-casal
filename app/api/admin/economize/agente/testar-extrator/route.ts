import {
  NextRequest,
  NextResponse,
} from "next/server";
import { load } from "cheerio";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extrairOfertasMercadoLivre } from "@/lib/economize/extratores/mercadoLivreOfertas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FonteTeste = {
  id: string;
  loja_id: string;
  nome: string;
  tipo: string;
  url: string | null;
  ativa: boolean;
  prioridade: number;
};

function obterMensagemErro(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado ao testar o extrator.";
}

function obterLimite(request: NextRequest) {
  const valor = Number(
    request.nextUrl.searchParams.get("limite")
  );

  if (!Number.isInteger(valor)) {
    return 10;
  }

  return Math.min(
    Math.max(valor, 1),
    30
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {
      return NextResponse.json(
        {
          error: "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: fonteEncontrada,
      error: erroFonte,
    } = await supabaseAdmin
      .from("economize_fontes")
      .select(`
        id,
        loja_id,
        nome,
        tipo,
        url,
        ativa,
        prioridade
      `)
      .eq("ativa", true)
      .ilike(
        "url",
        "%mercadolivre.com.br/ofertas%"
      )
      .order("prioridade", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (erroFonte) {
      console.error(
        "Erro ao localizar fonte do Mercado Livre:",
        erroFonte
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível localizar a fonte cadastrada.",
        },
        {
          status: 500,
        }
      );
    }

    const fonte =
      fonteEncontrada as FonteTeste | null;

    if (!fonte || !fonte.url) {
      return NextResponse.json(
        {
          error:
            "Nenhuma fonte ativa do Mercado Livre foi encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const controlador =
      new AbortController();

    const temporizador = setTimeout(() => {
      controlador.abort();
    }, 20000);

    const inicioConsulta = Date.now();

    let resposta: Response;

    try {
      resposta = await fetch(fonte.url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controlador.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language":
            "pt-BR,pt;q=0.9,en;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
        },
      });
    } catch (error) {
      const mensagem =
        error instanceof Error &&
        error.name === "AbortError"
          ? "A consulta excedeu o limite de 20 segundos."
          : obterMensagemErro(error);

      return NextResponse.json(
        {
          error:
            "Não foi possível acessar a página de ofertas.",
          detalhes: mensagem,
        },
        {
          status: 502,
        }
      );
    } finally {
      clearTimeout(temporizador);
    }

    const duracaoConsultaMs = Math.max(
      Date.now() - inicioConsulta,
      1
    );

    if (!resposta.ok) {
      return NextResponse.json(
        {
          error:
            "O Mercado Livre não retornou uma resposta válida.",
          status_http: resposta.status,
          content_type:
            resposta.headers.get(
              "content-type"
            ),
          duracao_consulta_ms:
            duracaoConsultaMs,
        },
        {
          status: 502,
        }
      );
    }

    const html = await resposta.text();

    const $ = load(html);

    const cardsEncontrados =
      $(".poly-card").length;

    const inicioExtracao = Date.now();

    const ofertas =
      extrairOfertasMercadoLivre(
        html,
        fonte.url
      );

    const duracaoExtracaoMs = Math.max(
      Date.now() - inicioExtracao,
      1
    );

    const limite = obterLimite(request);

    const ofertasComImagem =
      ofertas.filter(
        (oferta) =>
          Boolean(oferta.imagem_url)
      ).length;

    const ofertasComPrecoOriginal =
      ofertas.filter(
        (oferta) =>
          oferta.preco_original !== null
      ).length;

    const ofertasComDesconto =
      ofertas.filter(
        (oferta) =>
          oferta.desconto_percentual !==
          null
      ).length;

    const codigosUnicos = new Set(
      ofertas
        .map((oferta) => oferta.codigo)
        .filter(Boolean)
    ).size;

    return NextResponse.json(
      {
        mensagem:
          "Teste concluído sem gravar dados no banco.",

        fonte: {
          id: fonte.id,
          loja_id: fonte.loja_id,
          nome: fonte.nome,
          tipo: fonte.tipo,
          url: fonte.url,
          prioridade:
            fonte.prioridade,
        },

        consulta: {
          status_http:
            resposta.status,
          content_type:
            resposta.headers.get(
              "content-type"
            ),
          tamanho_html: html.length,
          duracao_ms:
            duracaoConsultaMs,
        },

        extracao: {
          cards_encontrados:
            cardsEncontrados,
          ofertas_validas:
            ofertas.length,
          ofertas_com_imagem:
            ofertasComImagem,
          ofertas_com_preco_original:
            ofertasComPrecoOriginal,
          ofertas_com_desconto:
            ofertasComDesconto,
          codigos_unicos:
            codigosUnicos,
          duracao_ms:
            duracaoExtracaoMs,
        },

        amostra: ofertas
          .slice(0, limite)
          .map((oferta, indice) => ({
            numero: indice + 1,
            titulo: oferta.titulo,
            codigo: oferta.codigo,
            preco_original:
              oferta.preco_original,
            preco_oferta:
              oferta.preco_oferta,
            desconto_percentual:
              oferta.desconto_percentual,
            imagem_url:
              oferta.imagem_url,
            link_destino:
              oferta.link_destino,
            dedupe_key:
              oferta.dedupe_key,
            vendedor:
              oferta.dados_brutos
                .vendedor,
            frete:
              oferta.dados_brutos
                .frete,
          })),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "Erro ao testar extrator do Mercado Livre:",
      error
    );

    return NextResponse.json(
      {
        error:
          "O teste do extrator não foi concluído.",
        detalhes:
          obterMensagemErro(error),
      },
      {
        status: 500,
      }
    );
  }
}