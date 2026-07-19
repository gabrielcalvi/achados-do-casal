import { extrairMercadoLivre } from "./mercadoLivre";

export async function extrairProduto(link: string) {
  if (
    link.includes("mercadolivre") ||
    link.includes("meli.la")
  ) {
    return extrairMercadoLivre(link);
  }

  throw new Error("Loja ainda não suportada.");
}