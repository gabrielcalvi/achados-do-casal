import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

const REPOSITORY = "gabrielcalvi/achados-do-casal";

async function executar(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, cmd: string, args: string[]) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel" });
  if (resultado.exitCode !== 0) throw new Error((await resultado.stderr()).trim() || `Falha em ${cmd}`);
}

export default async function CeaCatalogoBuildPage() {
  try {
    const sandbox = await Sandbox.get({ name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test" });
    const awinToken = process.env.AWIN_API_TOKEN;
    const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
    const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) throw new Error("Variáveis incompletas.");

    await executar(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);
    for (const [arquivo, destino] of [
      ["scripts/varrer-produtos-awin-legacy.cjs", "/vercel/scripts/varrer-produtos-awin-legacy.cjs"],
      ["scripts/varrer-produtos-awin-legacy-wrapper.cjs", "/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs"],
      ["scripts/awin-lojas.config.cjs", "/vercel/scripts/awin-lojas.config.cjs"],
    ]) {
      await executar(sandbox, "curl", ["-fsSL", "--max-time", "30", `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/${arquivo}`, "-o", destino]);
    }

    await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs", "CONFIRMAR"],
      cwd: "/vercel",
      env: {
        AWIN_API_TOKEN: awinToken,
        AWIN_DATAFEED_API_KEY: datafeedKey,
        AWIN_PUBLISHER_ID: publisher,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        AWIN_PRODUTOS_LOJAS: "cea",
        AWIN_PRODUTOS_CATALOGO_LOJAS: "cea",
        AWIN_PRODUTOS_LIMITE_POR_LOJA: "60",
        AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      },
      detached: true,
    });
    console.log("[CEA CATALOGO BUILD] Carga C&A iniciada.");
  } catch (erro) {
    console.log("[CEA CATALOGO BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }
  return <main>Carga catálogo C&amp;A.</main>;
}
