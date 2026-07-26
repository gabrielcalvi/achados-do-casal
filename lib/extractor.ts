import { extrairMercadoLivreWorker } from "@/lib/workers/playwrightWorker";
import { extrairAmazonWorker } from "@/lib/workers/amazonWorker";
import { extrairMagaluWorker } from "@/lib/workers/magaluWorker";
import { extrairCeaWorker } from "@/lib/workers/ceaWorker";
import { extrairKabumWorker } from "@/lib/workers/kabumWorker";

export async function extrairProduto(link: string) {
  const linkNormalizado = link.toLowerCase();

  if (
    linkNormalizado.includes("mercadolivre") ||
    linkNormalizado.includes("mercadolibre") ||
    linkNormalizado.includes("meli.la")
  ) {
    return extrairMercadoLivreWorker(link);
  }

  if (
    linkNormalizado.includes("amazon.com.br") ||
    linkNormalizado.includes("amzn.to")
  ) {
    return extrairAmazonWorker(link);
  }

if (
  linkNormalizado.includes("magazineluiza.com.br") ||
  linkNormalizado.includes("magalu") ||
  linkNormalizado.includes("magazinevoce.com.br")
) {
  return extrairMagaluWorker(link);
}
if (
  linkNormalizado.includes("cea.com.br") ||
  linkNormalizado.includes("awinmid=17648") ||
  (
    linkNormalizado.includes("awin1.com") &&
    linkNormalizado.includes("cea.com.br")
  )
) {
  return extrairCeaWorker(link);
}
if (
  linkNormalizado.includes("kabum.com.br") ||
  linkNormalizado.includes("awinmid=17729")
) {
  return extrairKabumWorker(link);
}
  throw new Error("Loja ainda não suportada.");
}