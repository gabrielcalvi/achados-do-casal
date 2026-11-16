import type { LojaBlackFriday } from "@/lib/economize/blackFridayRadar";

/**
 * Marcas adicionais priorizadas depois da expansão principal do radar.
 * Mantidas separadas para facilitar ampliações rápidas sem alterar o coletor.
 */
export const LOJAS_BLACK_FRIDAY_EXTRAS: LojaBlackFriday[] = [
  {
    nome: "Decolar",
    slug: "decolar",
    dominio: "decolar.com",
    homepage: "https://www.decolar.com/",
  },
  {
    nome: "Tramontina",
    slug: "tramontina",
    dominio: "tramontina.com.br",
    homepage: "https://www.tramontina.com.br/",
  },
  {
    nome: "Cobasi",
    slug: "cobasi",
    dominio: "cobasi.com.br",
    homepage: "https://www.cobasi.com.br/",
  },
  {
    nome: "Microsoft Store / Xbox",
    slug: "microsoft-store",
    dominio: "microsoft.com",
    homepage: "https://www.microsoft.com/pt-br/store/b/home",
  },
  {
    nome: "Nuuvem",
    slug: "nuuvem",
    dominio: "nuuvem.com",
    homepage: "https://www.nuuvem.com/br-pt/",
  },
  {
    nome: "Farmácias São João",
    slug: "farmacias-sao-joao",
    dominio: "saojoaofarmacias.com.br",
    homepage: "https://www.saojoaofarmacias.com.br/",
  },
];
