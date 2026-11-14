import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IngressoLegadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/viagens/pacote/${id}`);
}
