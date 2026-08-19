import PartnerAwinAdmin from "@/components/PartnerAwinAdmin";

export default function AdminNikeAwinPage() {
  return (
    <PartnerAwinAdmin
      nome="Nike"
      slug="nike"
      vitrine="/nike"
      auditoriaUrl="/api/admin/economize/nike/auditoria"
      atualizarUrl="/api/admin/economize/awin/nike/produtos/executar"
      advertiserId="17652"
      destaqueClass="bg-black hover:bg-zinc-800"
      permitePendentes
    />
  );
}
