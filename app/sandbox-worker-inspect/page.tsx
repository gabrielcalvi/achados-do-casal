import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function SandboxWorkerInspectPage() {
  const ambiente = process.env.VERCEL_ENV ?? "";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";

  if (ambiente !== "preview" || branch !== "feature/monitor-precos-automatico") {
    return <pre>inspecao ignorada</pre>;
  }

  const sandbox = await Sandbox.get({ name: "achados-cupons-ml-test" });
  const resultado = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      "grep -n -E 'pathname ===|pathname ==|storageState|setStorageState|sess[aã]o|auth' /vercel/playwright-worker.cjs | tail -n 160",
    ],
    cwd: "/vercel",
  });

  const dados = {
    exitCode: resultado.exitCode,
    stdout: (await resultado.stdout()).trim(),
    stderr: (await resultado.stderr()).trim(),
  };

  console.log("[SANDBOX WORKER INSPECT]", JSON.stringify(dados));

  return <pre>{JSON.stringify(dados, null, 2)}</pre>;
}
