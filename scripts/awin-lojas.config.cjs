const lojas = [
  {
    slug: "cea",
    dbSlug: "cea",
    nome: "C&A",
    advertiserId: "17648",
    dominio: "cea.com.br",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6c/Cea-logo-2026.png"
  },
  {
    slug: "renner",
    dbSlug: "renner",
    nome: "Renner/Ashua",
    advertiserId: "70694",
    dominio: "lojasrenner.com.br",
    logoUrl: null
  },
  {
    slug: "calvin-klein",
    dbSlug: "calvin-klein",
    nome: "Calvin Klein",
    advertiserId: "100553",
    dominio: "calvinklein.com.br",
    logoUrl: null
  },
  {
    slug: "stanley",
    dbSlug: "stanley",
    nome: "Stanley",
    advertiserId: "30599",
    dominio: "stanley1913.com.br",
    logoUrl: null
  },
  {
    slug: "nike",
    dbSlug: "nike",
    nome: "Nike",
    advertiserId: "17652",
    dominio: "nike.com.br",
    logoUrl: null
  },
  {
    slug: "decolar",
    dbSlug: "decolar",
    nome: "Decolar",
    advertiserId: "102459",
    dominio: "decolar.com",
    logoUrl: null,
    monitorOnly: true
  }
];

const casasBahiaAdvertiserId = String(
  process.env.CASAS_BAHIA_AWIN_ADVERTISER_ID || ""
).trim();

if (casasBahiaAdvertiserId) {
  lojas.push({
    slug: "casas-bahia",
    dbSlug: "casas-bahia",
    nome: "Casas Bahia",
    advertiserId: casasBahiaAdvertiserId,
    dominio: "casasbahia.com.br",
    logoUrl: null
  });
}

module.exports = lojas;
