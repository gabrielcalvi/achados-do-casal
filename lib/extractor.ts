import { extrairMercadoLivreWorker } from "@/lib/workers/playwrightWorker";

export async function extrairProduto(link: string) {
  if (
    link.includes("mercadolivre") ||
    link.includes("meli.la")
  ) {
    return extrairMercadoLivreWorker(link);
  }

  throw new Error("Loja ainda não suportada.");
}