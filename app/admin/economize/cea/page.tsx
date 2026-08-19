import PartnerAwinAdmin from "@/components/PartnerAwinAdmin";

export default function AdminCeaPage() {
  return (
    <PartnerAwinAdmin
      nome="C&A"
      slug="cea"
      vitrine="/cea"
      auditoriaUrl="/api/admin/economize/parceiros/cea/auditoria"
      atualizarUrl="/api/admin/economize/awin/produtos/executar"
      advertiserId="17648"
      destaqueClass="bg-[#e30613] hover:bg-[#c5000c]"
    />
  );
}
