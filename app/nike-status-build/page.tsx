import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const STATUS = "/vercel/tmp/awin-nike-produtos-status.json";
const RESULT = "/vercel/tmp/awin-nike-produtos-resultado.json";

async function ler() {
  if (process.env.VERCEL_ENV !== "production") return "ignorado";

  const sandbox = await Sandbox.get({ name: SANDBOX_NAME });

  for (const caminho of [STATUS, RESULT]) {
    const comando = await sandbox.runCommand({ cmd: "cat", args: [caminho], cwd: "/vercel" });
    if (comando.exitCode === 0) {
      const texto = (await comando.stdout()).trim();
      if (texto) {
        console.log(`[NIKE STATUS BUILD] ${caminho}: ${texto}`);
        return texto;
      }
    }
  }

  console.log("[NIKE STATUS BUILD] Nenhum arquivo de status/resultado encontrado.");
  return "sem_status";
}

export default async function NikeStatusBuildPage() {
  const status = await ler();
  return <main>nike status: {status}</main>;
}
