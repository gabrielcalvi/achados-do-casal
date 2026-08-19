import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function KabumStatusBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });

    const status = await sandbox.runCommand({
      cmd: "cat",
      args: ["/vercel/tmp/kabum-awin-status.json"],
      cwd: "/vercel",
    });
    console.log("[KABUM PIPELINE STATUS FRESH]", (await status.stdout()).trim() || (await status.stderr()).trim() || `exit=${status.exitCode}`);

    const log = await sandbox.runCommand({
      cmd: "tail",
      args: ["-n", "120", "/vercel/tmp/kabum-awin.log"],
      cwd: "/vercel",
    });
    console.log("[KABUM PIPELINE LOG FRESH]", (await log.stdout()).trim() || (await log.stderr()).trim() || `exit=${log.exitCode}`);
  } catch (erro) {
    console.log("[KABUM STATUS BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Diagnóstico temporário KaBuM · leitura atualizada.</main>;
}
