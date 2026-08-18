import { monitorarProdutosAutomaticamente } from "@/lib/services/automaticPriceMonitor";

export const dynamic = "force-static";

export default async function MonitorSmokeOncePage() {
  const ambiente = process.env.VERCEL_ENV ?? "";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";

  if (
    ambiente !== "preview" ||
    branch !== "feature/monitor-precos-automatico"
  ) {
    return <pre>teste ignorado</pre>;
  }

  console.log("[MONITOR SMOKE ONCE] Iniciando teste de 1 produto...");
  const resultado = await monitorarProdutosAutomaticamente(1);
  console.log("[MONITOR SMOKE ONCE] Resultado:", JSON.stringify(resultado));

  return <pre>{JSON.stringify(resultado, null, 2)}</pre>;
}
