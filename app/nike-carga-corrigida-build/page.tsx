import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const BASE_DIR = "/vercel/scripts";
const LEGACY = `${BASE_DIR}/varrer-produtos-awin-legacy.cjs`;
const NIKE = `${BASE_DIR}/varrer-produtos-awin-nike-seguro.cjs`;
const CONFIG = `${BASE_DIR}/awin-lojas.config.cjs`;

async function disparar() {
  if (process.env.VERCEL_ENV !== "production") return "ignorado";

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    throw new Error("Variaveis AWIN/Data Feed/Supabase incompletas em producao.");
  }

  const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
  await sandbox.runCommand({ cmd: "mkdir", args: ["-p", "/vercel/scripts", "/vercel/tmp"], cwd: "/vercel" });

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
  for (const [url, destino] of [
    [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`, LEGACY],
    [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-nike-seguro.cjs`, NIKE],
    [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`, CONFIG],
  ]) {
    const r = await sandbox.runCommand({ cmd: "curl", args: ["-fsSL", "--max-time", "30", url, "-o", destino], cwd: "/vercel" });
    if (r.exitCode !== 0) throw new Error(`Falha sincronizando ${destino}.`);
  }

  await sandbox.runCommand({
    cmd: "node",
    args: [NIKE, "CONFIRMAR"],
    cwd: "/vercel",
    env: {
      AWIN_API_TOKEN: awinToken,
      AWIN_DATAFEED_API_KEY: datafeedKey,
      AWIN_PUBLISHER_ID: publisher,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      NIKE_AWIN_LIMITE_PRODUTOS: "16",
      NIKE_AWIN_DESCONTO_MINIMO: "10",
      NIKE_AWIN_OBSERVACAO_HORAS: "24",
    },
    detached: true,
  });

  console.log("[NIKE CARGA CORRIGIDA] Scanner iniciado.");
  return "iniciado";
}

export default async function NikeCargaCorrigidaBuild() {
  const status = await disparar();
  return <main>{status}</main>;
}
