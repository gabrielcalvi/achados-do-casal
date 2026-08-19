import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function KabumPipelineBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });

    const awinToken = process.env.AWIN_API_TOKEN;
    const publisherId = process.env.AWIN_PUBLISHER_ID || "2922231";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!awinToken || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis KaBuM incompletas no build.");
    }

    const existe = await sandbox.runCommand({
      cmd: "test",
      args: ["-f", "/vercel/scripts/orquestrar-kabum-awin.cjs"],
      cwd: "/vercel",
    });
    if (existe.exitCode !== 0) throw new Error("Orquestrador KaBuM nao encontrado no Sandbox.");

    await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/scripts/orquestrar-kabum-awin.cjs"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_PUBLISHER_ID: publisherId,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      },
      detached: true,
    });

    console.log("[KABUM PIPELINE BUILD] Orquestrador completo iniciado no Sandbox.");
  } catch (erro) {
    console.log("[KABUM PIPELINE BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Gatilho temporário do pipeline KaBuM.</main>;
}
