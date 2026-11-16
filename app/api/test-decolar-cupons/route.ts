import { extrairCuponsFonteOficial } from "@/lib/economize/blackFridayRadar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const loja = {
    nome: "Decolar",
    slug: "decolar",
    dominio: "decolar.com",
    homepage: "https://www.decolar.com/",
  };
  const cupons = await extrairCuponsFonteOficial(loja);
  return Response.json({ sucesso: true, quantidade: cupons.length, cupons });
}
