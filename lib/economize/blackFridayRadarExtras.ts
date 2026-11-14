import type { LojaBlackFriday } from "@/lib/economize/blackFridayRadar";

/**
 * Marcas adicionais priorizadas depois da expansão principal do radar.
 * Mantidas separadas para facilitar ampliações rápidas sem alterar o coletor.
 */
export const LOJAS_BLACK_FRIDAY_EXTRAS: LojaBlackFriday[] = [
  {
    nome: "Tramontina",
    slug: "tramontina",
    dominio: "tramontina.com.br",
    homepage: "https://www.tramontina.com.br/",
  },
  {
    nome: "Farmácias São João",
    slug: "farmacias-sao-joao",
    dominio: "saojoaofarmacias.com.br",
    homepage: "https://www.saojoaofarmacias.com.br/",
  },
];
