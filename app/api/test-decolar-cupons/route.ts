import { processarLojaBlackFriday } from "@/lib/economize/blackFridayRadar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const resultado = await processarLojaBlackFriday({
    nome: "Decolar",
    slug: "decolar",
    dominio: "decolar.com",
    homepage: "https://www.decolar.com/",
  });
  return Response.json({ sucesso: true, resultado });
}
