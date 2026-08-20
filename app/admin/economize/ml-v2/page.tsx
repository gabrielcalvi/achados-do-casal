import Link from "next/link";
import PainelMlV2 from "../PainelMlV2";
import RenovarSessaoMlV2 from "./RenovarSessaoMlV2";
import PublicacaoSeguraMlV2 from "./PublicacaoSeguraMlV2";
import MlV2AplicarSemCodigo from "./MlV2AplicarSemCodigo";
import ComissaoManualMlV2 from "./ComissaoManualMlV2";
import DescarteLoteGuardMlV2 from "./DescarteLoteGuardMlV2";
import "./ml-v2.css";

export default function AdminMlV2Page() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <DescarteLoteGuardMlV2 />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-blue-600">
              Achados do Casal
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              🏷️ Mercado Livre — Cupons V2
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              Coleta cupons oficiais do Mercado Livre e mantém a publicação
              protegida até o candidato ser aprovado, validado em conta compradora
              e vinculado a um link afiliado do Achados do Casal.
            </p>
          </div>

          <Link
            href="/admin/economize"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
          >
            ← Voltar à Central Economize
          </Link>
        </header>

        <PainelMlV2 />
        <ComissaoManualMlV2 />
        <PublicacaoSeguraMlV2 />
        <MlV2AplicarSemCodigo />
        <RenovarSessaoMlV2 />
      </div>
    </main>
  );
}
