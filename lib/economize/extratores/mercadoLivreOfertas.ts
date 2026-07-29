import { createHash } from "node:crypto";
import {
  load,
  type Cheerio,
} from "cheerio";
import type { Element } from "domhandler";

const URL_OFERTAS_MERCADO_LIVRE =
  "https://www.mercadolivre.com.br/ofertas";

const VERSAO_EXTRATOR =
  "mercado-livre-ofertas-v1";

export type OfertaMercadoLivreExtraida = {
  titulo: string;
  codigo: string | null;
  imagem_url: string | null;
  link_destino: string;
  preco_original: number | null;
  preco_oferta: number;
  desconto_percentual: number | null;
  dedupe_key: string;
  dados_brutos: {
    extrator: string;
    fonte_url: string;
    indice_card: number;
    vendedor: string | null;
    frete: string | null;
    preco_original_texto: string | null;
    preco_oferta_texto: string | null;
  };
};

function limparTexto(
  valor: string | null | undefined
) {
  return (valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function arredondarValor(
  valor: number,
  casas = 2
) {
  const multiplicador =
    10 ** casas;

  return (
    Math.round(
      valor * multiplicador
    ) / multiplicador
  );
}

function lerValorMonetario(
  elemento: Cheerio<Element>
): number | null {
  if (elemento.length === 0) {
    return null;
  }

  const fracaoTexto = limparTexto(
    elemento
      .find(
        ".andes-money-amount__fraction"
      )
      .first()
      .text()
  );

  const centavosTexto = limparTexto(
    elemento
      .find(
        ".andes-money-amount__cents"
      )
      .first()
      .text()
  );

  if (fracaoTexto) {
    const fracao = Number(
      fracaoTexto.replace(/\D/g, "")
    );

    const centavos = centavosTexto
      ? Number(
          centavosTexto
            .replace(/\D/g, "")
            .padEnd(2, "0")
            .slice(0, 2)
        )
      : 0;

    if (
      Number.isFinite(fracao) &&
      Number.isFinite(centavos)
    ) {
      return arredondarValor(
        fracao + centavos / 100
      );
    }
  }

  const ariaLabel = limparTexto(
    elemento.attr("aria-label")
  );

  const resultadoAria =
    ariaLabel.match(
      /([\d.]+)\s+reais?(?:\s+com\s+(\d{1,2})\s+centavos?)?/i
    );

  if (resultadoAria) {
    const reais = Number(
      resultadoAria[1].replace(
        /\D/g,
        ""
      )
    );

    const centavos = resultadoAria[2]
      ? Number(resultadoAria[2])
      : 0;

    if (
      Number.isFinite(reais) &&
      Number.isFinite(centavos)
    ) {
      return arredondarValor(
        reais + centavos / 100
      );
    }
  }

  const textoCompleto = limparTexto(
    elemento.text()
  ).replace(/\s/g, "");

  const resultadoTexto =
    textoCompleto.match(
      /(\d[\d.]*)(?:,(\d{1,2}))?/
    );

  if (!resultadoTexto) {
    return null;
  }

  const reais = Number(
    resultadoTexto[1].replace(
      /\./g,
      ""
    )
  );

  const centavos = resultadoTexto[2]
    ? Number(
        resultadoTexto[2]
          .padEnd(2, "0")
          .slice(0, 2)
      )
    : 0;

  if (
    !Number.isFinite(reais) ||
    !Number.isFinite(centavos)
  ) {
    return null;
  }

  return arredondarValor(
    reais + centavos / 100
  );
}

function normalizarUrl(
  valor: string,
  urlBase: string
) {
  try {
    const url = new URL(
      valor,
      urlBase
    );

    url.hash = "";

    const parametrosRastreamento = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "gbraid",
      "wbraid",
      "matt_tool",
      "matt_word",
      "matt_source",
      "matt_campaign",
      "matt_ad_group",
      "matt_match_type",
      "matt_network",
      "matt_device",
      "matt_creative",
      "matt_keyword",
      "matt_ad_position",
    ];

    for (
      const parametro
      of parametrosRastreamento
    ) {
      url.searchParams.delete(
        parametro
      );
    }

    return url.toString();
  } catch {
    return valor.trim();
  }
}

function normalizarImagem(
  valor: string | undefined,
  urlBase: string
) {
  if (!valor) {
    return null;
  }

  if (
    valor.startsWith("data:")
  ) {
    return null;
  }

  try {
    return new URL(
      valor,
      urlBase
    ).toString();
  } catch {
    return valor;
  }
}

function obterCodigoMercadoLivre(
  link: string
) {
  const resultado = link.match(
    /\bMLB-?\d+\b/i
  );

  if (!resultado) {
    return null;
  }

  return resultado[0]
    .replace("-", "")
    .toUpperCase();
}

function criarDedupeKey(
  codigo: string | null,
  link: string,
  titulo: string
) {
  if (codigo) {
    return `mercadolivre:${codigo}`;
  }

  const hash = createHash("sha256")
    .update(
      `${link.toLowerCase()}|${titulo.toLowerCase()}`
    )
    .digest("hex")
    .slice(0, 32);

  return `mercadolivre:${hash}`;
}

function calcularDesconto(
  precoOriginal: number | null,
  precoOferta: number
) {
  if (
    precoOriginal === null ||
    precoOriginal <= 0 ||
    precoOferta >= precoOriginal
  ) {
    return null;
  }

  return arredondarValor(
    ((precoOriginal -
      precoOferta) /
      precoOriginal) *
      100
  );
}

function localizarLink(
  card: Cheerio<Element>,
  urlBase: string
) {
  const seletores = [
    "a.poly-component__title",
    ".poly-component__title-wrapper a",
    ".poly-card__content a[href]",
    "a[href]",
  ];

  for (const seletor of seletores) {
    const href = card
      .find(seletor)
      .first()
      .attr("href");

    if (href) {
      return normalizarUrl(
        href,
        urlBase
      );
    }
  }

  return null;
}

function localizarPrecoOferta(
  card: Cheerio<Element>
) {
  const seletores = [
    ".poly-price__current .andes-money-amount",
    ".poly-component__price .andes-money-amount:not(.andes-money-amount--previous)",
  ];

  for (const seletor of seletores) {
    const elemento = card
      .find(seletor)
      .first();

    const valor =
      lerValorMonetario(elemento);

    if (
      valor !== null &&
      valor > 0
    ) {
      return {
        valor,
        texto:
          limparTexto(
            elemento.text()
          ) || null,
      };
    }
  }

  return {
    valor: null,
    texto: null,
  };
}

function localizarPrecoOriginal(
  card: Cheerio<Element>
) {
  const elemento = card
    .find(
      ".andes-money-amount--previous"
    )
    .first();

  return {
    valor:
      lerValorMonetario(elemento),
    texto:
      limparTexto(
        elemento.text()
      ) || null,
  };
}

export function extrairOfertasMercadoLivre(
  html: string,
  fonteUrl =
    URL_OFERTAS_MERCADO_LIVRE
): OfertaMercadoLivreExtraida[] {
  if (!html.trim()) {
    return [];
  }

  const $ = load(html);

  const ofertas = new Map<
    string,
    OfertaMercadoLivreExtraida
  >();

  $(".poly-card").each(
    (indice, elemento) => {
      const card = $(elemento);

      const titulo = limparTexto(
        card
          .find(
            ".poly-component__title"
          )
          .first()
          .text()
      );

      if (!titulo) {
        return;
      }

      const link = localizarLink(
        card,
        fonteUrl
      );

      if (!link) {
        return;
      }

      const precoOferta =
        localizarPrecoOferta(card);

      if (
        precoOferta.valor === null ||
        precoOferta.valor <= 0
      ) {
        return;
      }

      const precoOriginal =
        localizarPrecoOriginal(card);

      const elementoImagem = card
        .find(
          [
            "img.poly-component__picture",
            ".poly-component__picture img",
          ].join(", ")
        )
        .first();

      const imagemUrl =
        normalizarImagem(
          elementoImagem.attr(
            "data-src"
          ) ||
            elementoImagem.attr(
              "data-lazy-src"
            ) ||
            elementoImagem.attr(
              "src"
            ),
          fonteUrl
        );

      const vendedor =
        limparTexto(
          card
            .find(
              ".poly-component__seller"
            )
            .first()
            .text()
        ) || null;

      const frete =
        limparTexto(
          card
            .find(
              ".poly-component__shipping"
            )
            .first()
            .text()
        ) || null;

      const codigo =
        obterCodigoMercadoLivre(
          link
        );

      const dedupeKey =
        criarDedupeKey(
          codigo,
          link,
          titulo
        );

      if (ofertas.has(dedupeKey)) {
        return;
      }

      ofertas.set(dedupeKey, {
        titulo,
        codigo,
        imagem_url: imagemUrl,
        link_destino: link,
        preco_original:
          precoOriginal.valor,
        preco_oferta:
          precoOferta.valor,
        desconto_percentual:
          calcularDesconto(
            precoOriginal.valor,
            precoOferta.valor
          ),
        dedupe_key: dedupeKey,
        dados_brutos: {
          extrator:
            VERSAO_EXTRATOR,
          fonte_url: fonteUrl,
          indice_card: indice,
          vendedor,
          frete,
          preco_original_texto:
            precoOriginal.texto,
          preco_oferta_texto:
            precoOferta.texto,
        },
      });
    }
  );

  return Array.from(
    ofertas.values()
  );
}