import { resolverItemId } from "@/lib/resolvers/mercadoLivre";
import { buscarProdutoMercadoLivre } from "@/lib/mercadolivre/api";

export async function extrairProduto(link: string) {
  if (
    link.includes("mercadolivre") ||
    link.includes("meli.la")
  ) {
    const itemId = await resolverItemId(link);

    if (!itemId) {
      throw new Error("Não foi possível identificar o produto.");
    }

    const produto = await buscarProdutoMercadoLivre(itemId);

    return {
      nome: produto.title,
      categoria: produto.category_id,
      loja: "Mercado Livre",
      precoAntigo: produto.original_price ?? 0,
      precoAtual: produto.price,
      imagem: produto.thumbnail,
    };
  }

  throw new Error("Loja ainda não suportada.");
}