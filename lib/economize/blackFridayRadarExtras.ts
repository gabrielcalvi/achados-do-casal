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
  // Supermercados e atacarejos
  { nome: "Zaffari / Bourbon", slug: "zaffari-bourbon", dominio: "zaffari.com.br", homepage: "https://www.zaffari.com.br/" },
  { nome: "Assaí Atacadista", slug: "assai", dominio: "assai.com.br", homepage: "https://www.assai.com.br/" },
  { nome: "Atacadão", slug: "atacadao", dominio: "atacadao.com.br", homepage: "https://www.atacadao.com.br/" },
  { nome: "Sam's Club", slug: "sams-club", dominio: "samsclub.com.br", homepage: "https://www.samsclub.com.br/" },
  { nome: "Pão de Açúcar", slug: "pao-de-acucar", dominio: "paodeacucar.com", homepage: "https://www.paodeacucar.com/" },
  { nome: "Angeloni", slug: "angeloni", dominio: "angeloni.com.br", homepage: "https://www.angeloni.com.br/" },

  // Delivery e alimentação
  { nome: "iFood", slug: "ifood", dominio: "ifood.com.br", homepage: "https://www.ifood.com.br/" },
  { nome: "Rappi", slug: "rappi", dominio: "rappi.com.br", homepage: "https://www.rappi.com.br/" },
  { nome: "99Food", slug: "99food", dominio: "99app.com", homepage: "https://99app.com/99food/" },
  { nome: "Domino's Pizza", slug: "dominos", dominio: "dominos.com.br", homepage: "https://www.dominos.com.br/" },
  { nome: "Pizza Hut", slug: "pizza-hut", dominio: "pizzahut.com.br", homepage: "https://www.pizzahut.com.br/" },
  { nome: "McDonald's", slug: "mcdonalds", dominio: "mcdonalds.com.br", homepage: "https://www.mcdonalds.com.br/" },
  { nome: "Burger King", slug: "burger-king", dominio: "burgerking.com.br", homepage: "https://www.burgerking.com.br/" },

  // Bebê e infantil
  { nome: "Alô Bebê", slug: "alo-bebe", dominio: "alobebe.com.br", homepage: "https://www.alobebe.com.br/" },
  { nome: "Pampers", slug: "pampers", dominio: "pampers.com.br", homepage: "https://www.pampers.com.br/" },
  { nome: "Huggies", slug: "huggies", dominio: "huggies.com.br", homepage: "https://www.huggies.com.br/" },

  // Móveis e decoração
  { nome: "MadeiraMadeira", slug: "madeira-madeira", dominio: "madeiramadeira.com.br", homepage: "https://www.madeiramadeira.com.br/" },
  { nome: "Mobly", slug: "mobly", dominio: "mobly.com.br", homepage: "https://www.mobly.com.br/" },
  { nome: "Westwing", slug: "westwing", dominio: "westwing.com.br", homepage: "https://www.westwing.com.br/" },
  { nome: "Camicado", slug: "camicado", dominio: "camicado.com.br", homepage: "https://www.camicado.com.br/" },
  { nome: "Madesa", slug: "madesa", dominio: "madesa.com", homepage: "https://www.madesa.com/" },

  // Ferramentas e materiais
  { nome: "Ferreira Costa", slug: "ferreira-costa", dominio: "ferreiracosta.com", homepage: "https://www.ferreiracosta.com/" },
  { nome: "Telhanorte", slug: "telhanorte", dominio: "telhanorte.com.br", homepage: "https://www.telhanorte.com.br/" },
  { nome: "Obramax", slug: "obramax", dominio: "obramax.com.br", homepage: "https://www.obramax.com.br/" },
  { nome: "Dutra Máquinas", slug: "dutra-maquinas", dominio: "dutra.com.br", homepage: "https://www.dutra.com.br/" },
  { nome: "Loja do Mecânico", slug: "loja-do-mecanico", dominio: "lojadomecanico.com.br", homepage: "https://www.lojadomecanico.com.br/" },

  // Óticas
  { nome: "Chilli Beans", slug: "chilli-beans", dominio: "chillibeans.com.br", homepage: "https://www.chillibeans.com.br/" },
  { nome: "Sunglass Hut", slug: "sunglass-hut", dominio: "sunglasshut.com", homepage: "https://www.sunglasshut.com/br" },
  { nome: "Óticas Carol", slug: "oticas-carol", dominio: "oticascarol.com.br", homepage: "https://www.oticascarol.com.br/" },
  { nome: "Lenscope", slug: "lenscope", dominio: "lenscope.com.br", homepage: "https://www.lenscope.com.br/" },

  // Livros e papelaria
  { nome: "Livraria Leitura", slug: "livraria-leitura", dominio: "leitura.com.br", homepage: "https://leitura.com.br/" },
  { nome: "Saraiva", slug: "saraiva", dominio: "saraiva.com.br", homepage: "https://www.saraiva.com.br/" },
  { nome: "Tilibra", slug: "tilibra", dominio: "tilibra.com.br", homepage: "https://www.tilibra.com.br/" },
  { nome: "Faber-Castell", slug: "faber-castell", dominio: "faber-castell.com.br", homepage: "https://www.faber-castell.com.br/" },

  // Assinaturas e serviços digitais
  { nome: "Canva", slug: "canva", dominio: "canva.com", homepage: "https://www.canva.com/pt_br/" },
  { nome: "Adobe", slug: "adobe", dominio: "adobe.com", homepage: "https://www.adobe.com/br/" },
  { nome: "Microsoft 365", slug: "microsoft-365", dominio: "microsoft.com", homepage: "https://www.microsoft.com/pt-br/microsoft-365" },
  { nome: "NordVPN", slug: "nordvpn", dominio: "nordvpn.com", homepage: "https://nordvpn.com/pt-br/" },
  { nome: "Surfshark", slug: "surfshark", dominio: "surfshark.com", homepage: "https://surfshark.com/pt-br" },
  { nome: "Hostinger", slug: "hostinger", dominio: "hostinger.com.br", homepage: "https://www.hostinger.com.br/" },

  // Pet shops
  { nome: "Petlove", slug: "petlove", dominio: "petlove.com.br", homepage: "https://www.petlove.com.br/" },

  // Farmácias
  { nome: "Farmácia Preço Popular", slug: "farmacia-preco-popular", dominio: "precopopular.com.br", homepage: "https://www.precopopular.com.br/" },

  // Fitness e suplementos
  { nome: "Growth Supplements", slug: "growth-supplements", dominio: "growthsupplements.com.br", homepage: "https://www.gsuplementos.com.br/" },
  { nome: "Integralmédica", slug: "integralmedica", dominio: "integralmedica.com.br", homepage: "https://www.integralmedica.com.br/" },
  { nome: "Max Titanium", slug: "max-titanium", dominio: "maxtitanium.com.br", homepage: "https://www.maxtitanium.com.br/" },

  // Seguro viagem e eSIM
  { nome: "Assist Card", slug: "assist-card", dominio: "assistcard.com", homepage: "https://www.assistcard.com/br" },
  { nome: "Universal Assistance", slug: "universal-assistance", dominio: "universal-assistance.com", homepage: "https://www.universal-assistance.com/br-pt" },
  { nome: "Allianz Travel", slug: "allianz-travel", dominio: "allianz-assistance.com.br", homepage: "https://www.allianz-assistance.com.br/" },
  { nome: "Seguros Promo", slug: "seguros-promo", dominio: "segurospromo.com.br", homepage: "https://www.segurospromo.com.br/" },
  { nome: "Airalo", slug: "airalo", dominio: "airalo.com", homepage: "https://www.airalo.com/pt-BR" },
  { nome: "Holafly", slug: "holafly", dominio: "holafly.com", homepage: "https://esim.holafly.com/pt/" },
  { nome: "Nomad eSIM", slug: "nomad-esim", dominio: "getnomad.app", homepage: "https://www.getnomad.app/pt" },

  // Parques e atrações
  { nome: "Beto Carrero World", slug: "beto-carrero", dominio: "betocarrero.com.br", homepage: "https://www.betocarrero.com.br/" },
  { nome: "Snowland", slug: "snowland", dominio: "snowland.com.br", homepage: "https://www.snowland.com.br/" },
  { nome: "Acquamotion", slug: "acquamotion", dominio: "acquamotion.com.br", homepage: "https://www.acquamotion.com.br/" },

  // Ingressos e entretenimento
  { nome: "Sympla", slug: "sympla", dominio: "sympla.com.br", homepage: "https://www.sympla.com.br/" },
  { nome: "Ticketmaster Brasil", slug: "ticketmaster", dominio: "ticketmaster.com.br", homepage: "https://www.ticketmaster.com.br/" },
  { nome: "Eventim", slug: "eventim", dominio: "eventim.com.br", homepage: "https://www.eventim.com.br/" },
  { nome: "Cinemark", slug: "cinemark", dominio: "cinemark.com.br", homepage: "https://www.cinemark.com.br/" },
  { nome: "UCI Cinemas", slug: "uci-cinemas", dominio: "ucicinemas.com.br", homepage: "https://www.ucicinemas.com.br/" },
  { nome: "Kinoplex", slug: "kinoplex", dominio: "kinoplex.com.br", homepage: "https://www.kinoplex.com.br/" },
];
