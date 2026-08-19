import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

async function ler(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, caminho: string) {
  const resultado = await sandbox.runCommand({ cmd: "cat", args: [caminho], cwd: "/vercel" });
  if (resultado.exitCode !== 0) return null;
  return (await resultado.stdout()).trim();
}

export default async function AwinCeaRennerStatusBuildPage() {
  try {
    const sandbox = await Sandbox.get({ name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test" });
    const status = await ler(sandbox, "/vercel/tmp/awin-produtos-status.json");
    const resultado = await ler(sandbox, "/vercel/tmp/awin-produtos-resultado.json");
    console.log("[AWIN CEA RENNER STATUS]", status || "sem status");
    console.log("[AWIN CEA RENNER RESULTADO]", resultado || "sem resultado");
  } catch (erro) {
    console.log("[AWIN CEA RENNER STATUS ERRO]", erro instanceof Error ? erro.message : String(erro));
  }
  return <main>Status AWIN C&amp;A / Renner.</main>;
}
