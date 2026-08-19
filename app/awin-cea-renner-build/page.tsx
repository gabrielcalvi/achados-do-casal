import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

const REPOSITORY = "gabrielcalvi/achados-do-casal";

async function executar(sandbox: Awaited<ReturnType<typeof Sandbox.get>>, cmd: string, args: string[]) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel" });
  if (resultado.exitCode !== 0) {
    const stderr = (await resultado.stderr()).trim();
    throw new Error(stderr || `Falha executando ${cmd}`);
  }
}

export default async function AwinCeaRennerBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });

    const awinToken = process.env.AWIN_API_TOKEN;
    const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
    const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";

    if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
      throw new Error("Variáveis AWIN/Data Feed/Supabase incompletas.");
    }

    await executar(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);

    const arquivos = [
      ["scripts/varrer-produtos-awin-legacy.cjs", "/vercel/scripts/varrer-produtos-awin-legacy.cjs"],
      ["scripts/varrer-produtos-awin-legacy-wrapper.cjs", "/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs"],
      ["scripts/awin-lojas.config.cjs", "/vercel/scripts/awin-lojas.config.cjs"],
    ];

    for (const [origem, destino] of arquivos) {
      await executar(sandbox, "curl", [
        "-fsSL",
        "--max-time",
        "30",
        `https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/${origem}`,
        "-o",
        destino,
      ]);
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
        AWIN_PRODUTOS_LOJAS: "cea,renner",
        AWIN_PRODUTOS_LIMITE_POR_LOJA: "60",
        AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      },
      detached: true,
    });

    console.log("[AWIN CEA RENNER BUILD] Carga dedicada iniciada no Sandbox.");
  } catch (erro) {
    console.log("[AWIN CEA RENNER BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Carga dedicada AWIN C&amp;A / Renner.</main>;
}
