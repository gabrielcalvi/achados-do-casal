import PartnerAwinAdmin from "@/components/PartnerAwinAdmin";

export default function AdminRennerPage() {
  return (
    <PartnerAwinAdmin
      nome="Renner"
      slug="renner"
      vitrine="/renner"
      auditoriaUrl="/api/admin/economize/parceiros/renner/auditoria"
      atualizarUrl="/api/admin/economize/awin/produtos/executar"
      advertiserId="70694"
      destaqueClass="bg-[#8b1e2d] hover:bg-[#731824]"
    />
  );
}
