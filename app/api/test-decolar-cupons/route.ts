import {
  buscarCuponation,
  extrairCuponsCuponation,
  extrairCuponsFonteOficial,
} from "@/lib/economize/blackFridayRadar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const loja = {
    nome: "Decolar",
    slug: "decolar",
    dominio: "decolar.com",
    homepage: "https://www.decolar.com/",
  };
  const oficiais = await extrairCuponsFonteOficial(loja);
  const fontes = await buscarCuponation(loja);
  const cuponation = fontes[0]?.url
    ? await extrairCuponsCuponation(loja, fontes[0].url)
    : [];
  return Response.json({
    sucesso: true,
    oficiais: { quantidade: oficiais.length, cupons: oficiais },
    cuponation: { fonte: fontes[0]?.url || null, quantidade: cuponation.length, cupons: cuponation },
  });
}
