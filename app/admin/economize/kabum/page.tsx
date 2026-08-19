import PartnerAwinAdmin from "@/components/PartnerAwinAdmin";

export default function AdminKabumAwinPage() {
  return (
    <PartnerAwinAdmin
      nome="KaBuM!"
      slug="kabum"
      vitrine="/kabum"
      auditoriaUrl="/api/admin/economize/kabum/auditoria"
      atualizarUrl="/api/admin/economize/awin/kabum/produtos/executar"
      advertiserId="17729"
      destaqueClass="bg-[#ff6500] hover:bg-[#e65c00]"
    />
  );
}
