import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function KabumStatusBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });
    const resultado = await sandbox.runCommand({
      cmd: "cat",
      args: ["/vercel/tmp/awin-kabum-produtos-status.json"],
      cwd: "/vercel",
    });
    const stdout = (await resultado.stdout()).trim();
    const stderr = (await resultado.stderr()).trim();
    console.log("[KABUM STATUS BUILD]", stdout || stderr || `exit=${resultado.exitCode}`);
  } catch (erro) {
    console.log("[KABUM STATUS BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Diagnóstico temporário KaBuM.</main>;
}
