import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function KabumCargaBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });

    const awinToken = process.env.AWIN_API_TOKEN;
    const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
    const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
      throw new Error("Variaveis KaBuM incompletas no build.");
    }

    await sandbox.runCommand({ cmd: "mkdir", args: ["-p", "/vercel/scripts", "/vercel/tmp"], cwd: "/vercel" });

    const arquivos = [
      ["scripts/varrer-produtos-awin-kabum.cjs", "/vercel/scripts/varrer-produtos-awin-kabum.cjs"],
      ["scripts/varrer-produtos-awin-legacy.cjs", "/vercel/scripts/varrer-produtos-awin-legacy.cjs"],
      ["scripts/awin-lojas.config.cjs", "/vercel/scripts/awin-lojas.config.cjs"],
    ];

    for (const [arquivo, destino] of arquivos) {
      const url = `https://raw.githubusercontent.com/gabrielcalvi/achados-do-casal/main/${arquivo}`;
      const download = await sandbox.runCommand({
        cmd: "curl",
        args: ["-fsSL", "--max-time", "30", url, "-o", destino],
        cwd: "/vercel",
      });
      if (download.exitCode !== 0) throw new Error(`Falha sincronizando ${arquivo}`);
    }

    await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/scripts/varrer-produtos-awin-kabum.cjs", "CONFIRMAR"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_DATAFEED_API_KEY: datafeedKey,
        AWIN_PUBLISHER_ID: publisher,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        KABUM_AWIN_LIMITE_PRODUTOS: "80",
        KABUM_AWIN_DESCONTO_MINIMO: "10",
      },
      detached: true,
    });

    console.log("[KABUM CARGA BUILD] Scanner normalizado iniciado.");
  } catch (erro) {
    console.log("[KABUM CARGA BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Carga temporária KaBuM.</main>;
}
