import { monitorarProdutosAutomaticamente } from "@/lib/services/automaticPriceMonitor";

export const dynamic = "force-static";

export default async function MonitorSmokePreviewPage() {
  const ambiente = process.env.VERCEL_ENV ?? "";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";

  if (
    ambiente !== "preview" ||
    branch !== "feature/monitor-precos-automatico"
  ) {
    return <pre>smoke test ignorado fora do preview controlado</pre>;
  }

  console.log("[MONITOR SMOKE] Iniciando rodada controlada de 12 produtos...");
  const resultado = await monitorarProdutosAutomaticamente(12);
  console.log("[MONITOR SMOKE] Resultado:", JSON.stringify(resultado));

  return <pre>{JSON.stringify(resultado, null, 2)}</pre>;
}
