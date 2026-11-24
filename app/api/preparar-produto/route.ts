import { NextResponse } from "next/server";
import { extrairProduto } from "@/lib/extractor";
import { extrairMercadoLivreComSessao } from "@/lib/services/mercadoLivreSandboxExtractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPO_LIMITE = 600000;

const CATEGORIAS_OFICIAIS = new Set([
  "Tecnologia",
  "Celulares",
  "Casa e Cozinha",
  "Jardim",
  "Decoração",
  "Beleza e Maquiagem",
  "Automotivo",
  "Esportes",
  "Saúde e Bem-estar",
  "Alimentos e Bebidas",
  "Ferramentas",
  "Moda",
  "Brinquedos",
  "Infantil",
  "Pet",
]);

function normalizarCategoria(categoria: unknown, nome: unknown) {
  const valor = String(categoria || "").trim();
  if (CATEGORIAS_OFICIAIS.has(valor)) return valor;

  const texto = `${valor} ${String(nome || "")}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(iphone|galaxy|smartphone|celular|telefone)/.test(texto)) return "Celulares";
  if (/(computador|informatica|notebook|monitor|mouse|teclado|headset|gaming|gamer|playstation|xbox|ssd|memoria|processador|placa de video|roteador)/.test(texto)) return "Tecnologia";
  if (/(furadeira|parafusadeira|ferramenta|serra|chave|broca|compressor|enxada|pa |pá |martelo|alicate)/.test(texto)) return "Ferramentas";
  if (/(bebe|infantil|crianca|menino|menina|kids)/.test(texto)) return "Infantil";
  if (/(brinquedo|lego|hot wheels|boneca|jogo de tabuleiro|pista)/.test(texto)) return "Brinquedos";
  if (/(pet|cachorro|gato|racao|arranhador)/.test(texto)) return "Pet";
  if (/(carro|automotivo|veiculo|diesel|pneu|oleo motor)/.test(texto)) return "Automotivo";
  if (/(jardim|jardinagem|grama|mangueira|vaso|floreira|canteiro|paisagismo|area externa|área externa)/.test(texto)) return "Jardim";
  if (/(natal|arvore de natal|árvore de natal|decoracao|decoração|inflavel|inflável|enfeite|ornamento|guirlanda|luz de natal|papai noel)/.test(texto)) return "Decoração";
  if (/(maquiagem|make\b|makeup|batom|gloss|rimel|rímel|mascara de cilios|máscara de cílios|base facial|corretivo|blush|iluminador|sombra|delineador|primer|paleta|skincare|cosmetico|cosmético|beleza)/.test(texto)) return "Beleza e Maquiagem";
  if (/(air fryer|cozinha|casa|movel|móvel|guarda-roupa|secador|eletrodomestico|sofa|sofá|poltrona|puff|sala|varanda)/.test(texto)) return "Casa e Cozinha";
  if (/(esporte|fitness|academia|bicicleta|bola|corrida)/.test(texto)) return "Esportes";
  if (/(saude|bem-estar|febre|nasal|farmacia|higiene)/.test(texto)) return "Saúde e Bem-estar";
  if (/(alimento|bebida|cafe|chocolate|mercado)/.test(texto)) return "Alimentos e Bebidas";
  if (/(roupa|moda|camisa|camiseta|vestido|calca|short|tenis|sapato|bolsa)/.test(texto)) return "Moda";

  return "Tecnologia";
}

async function executarComTimeout<T>(
  operacao: Promise<T>,
  tempo: number
): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    temporizador = setTimeout(() => {
      reject(new Error("A extração demorou mais de 10 minutos. Tente novamente."));
    }, tempo);
  });

  try {
    return await Promise.race([operacao, timeout]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

export async function POST(request: Request) {
  try {
    const corpo = await request.json();
    const link = String(corpo?.link || "").trim();

    if (!link) {
      return NextResponse.json({ error: "Link não informado." }, { status: 400 });
    }

    try {
      new URL(link);
    } catch {
      return NextResponse.json({ error: "O link informado não é válido." }, { status: 400 });
    }

    let dados = await executarComTimeout(extrairProduto(link), TEMPO_LIMITE);

    const ehMercadoLivre =
      /mercadolivre|mercadolibre|meli\.la/i.test(link) ||
      String(dados.loja || "").toLowerCase().includes("mercado livre");

    const galeriaAtual = Array.isArray(dados.imagensGaleria)
      ? dados.imagensGaleria.filter(Boolean)
      : [];

    if (
      ehMercadoLivre &&
      galeriaAtual.length === 0 &&
      !String(dados.imagem || "").trim()
    ) {
      const autenticado = await executarComTimeout(
        extrairMercadoLivreComSessao(link),
        120000,
      );

      if (autenticado.sucesso) {
        const extra = autenticado.dados;
        const imagens = Array.isArray(extra.imagensGaleria)
          ? extra.imagensGaleria.filter(Boolean)
          : [];

        dados = {
          ...dados,
          nome: extra.nome || dados.nome,
          precoAntigo: extra.precoAntigo || dados.precoAntigo,
          precoAtual: extra.precoAtual || dados.precoAtual,
          parcelas: extra.parcelas || dados.parcelas,
          freteGratis:
            extra.freteGratis === true
              ? true
              : dados.freteGratis,
          imagem: extra.imagem || dados.imagem,
          imagensGaleria:
            imagens.length > 0
              ? imagens
              : galeriaAtual,
          avaliacao: extra.avaliacao ?? dados.avaliacao,
          vendas: extra.vendas || dados.vendas,
        };
      } else if (autenticado.sessaoExpirada) {
        dados = {
          ...dados,
          avisoSessaoMercadoLivre:
            "A sessao autenticada do Mercado Livre expirou. Renove a sessao no painel ML V2 para voltar a puxar automaticamente as fotos dos anuncios bloqueados.",
        };
      }
    }

    const categoriaNormalizada = normalizarCategoria(dados.categoria, dados.nome);

    return NextResponse.json({
      sucesso: true,
      dados: {
        ...dados,
        categoria: categoriaNormalizada,
      },
    });
  } catch (error) {
    console.error("ERRO AO PREPARAR PRODUTO:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro interno ao preparar o produto.",
      },
      { status: 500 },
    );
  }
}
