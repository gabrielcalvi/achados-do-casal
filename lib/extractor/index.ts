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
    const id = await resolverItemId(link);

    if (!id) {
      throw new Error("Não foi possível identificar o produto.");
    }

    let itemId = id;

    if (link.includes("/p/")) {
      itemId = await buscarItemIdDoCatalogo(id);
    }

    const produto = await buscarProdutoMercadoLivre(itemId);

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