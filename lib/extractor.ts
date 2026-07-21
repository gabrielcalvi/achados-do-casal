import { resolverItemId } from "@/lib/resolvers/mercadoLivre";
import {
  buscarItemIdDoCatalogo,
  buscarProdutoMercadoLivre,
} from "@/lib/mercadolivre/api";

export async function extrairProduto(link: string) {
  if (
    link.includes("mercadolivre") ||
    link.includes("meli.la")
  ) {
    const referencia = await resolverItemId(link);

    if (!referencia) {
      throw new Error(
        "Não foi possível identificar o produto."
      );
    }

    let itemId: string;

    if (referencia.tipo === "item") {
      itemId = referencia.id;
    } else {
      itemId = await buscarItemIdDoCatalogo(
        referencia.id
      );
    }

    const produto =
      await buscarProdutoMercadoLivre(itemId);

    return {
      nome: produto.title,
      categoria: produto.category_id,
      loja: "Mercado Livre",
      precoAntigo: produto.original_price ?? 0,
      precoAtual: produto.price,
      imagem: produto.thumbnail,
      urlFinal: produto.permalink,
    };
  }

  throw new Error("Loja ainda não suportada.");
}