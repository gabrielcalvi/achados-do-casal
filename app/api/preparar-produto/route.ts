import { NextResponse } from "next/server";
import { extrairProduto } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPO_LIMITE = 600000;

const CATEGORIAS_OFICIAIS = new Set([
  "Tecnologia",
  "Celulares",
  "Casa e Cozinha",
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
  if (/(furadeira|parafusadeira|ferramenta|serra|chave|broca|compressor)/.test(texto)) return "Ferramentas";
  if (/(bebe|infantil|crianca|menino|menina|kids)/.test(texto)) return "Infantil";
  if (/(brinquedo|lego|hot wheels|boneca|jogo de tabuleiro|pista)/.test(texto)) return "Brinquedos";
  if (/(pet|cachorro|gato|racao|arranhador)/.test(texto)) return "Pet";
  if (/(carro|automotivo|veiculo|diesel|pneu|oleo motor)/.test(texto)) return "Automotivo";
  if (/(air fryer|cozinha|casa|movel|guarda-roupa|secador|eletrodomestico)/.test(texto)) return "Casa e Cozinha";
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

    const dados = await executarComTimeout(extrairProduto(link), TEMPO_LIMITE);
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
