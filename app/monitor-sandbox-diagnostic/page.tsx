import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function MonitorSandboxDiagnosticPage() {
  const ambiente = process.env.VERCEL_ENV ?? "";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";

  if (
    ambiente !== "preview" ||
    branch !== "feature/monitor-precos-automatico"
  ) {
    return <pre>diagnostico ignorado</pre>;
  }

  const sandbox = await Sandbox.get({ name: "achados-cupons-ml-test" });

  async function rodar(cmd: string, args: string[]) {
    const resultado = await sandbox.runCommand({ cmd, args });
    return {
      exitCode: resultado.exitCode,
      stdout: (await resultado.stdout()).trim(),
      stderr: (await resultado.stderr()).trim(),
    };
  }

  const diagnostico = {
    data: new Date().toISOString(),
    processos: await rodar("sh", ["-lc", "ps aux | grep -E 'playwright-worker|chromium|xvfb' | grep -v grep || true"]),
    curl: await rodar("curl", ["-v", "--max-time", "8", "http://127.0.0.1:4317/health"]),
    portas: await rodar("sh", ["-lc", "(ss -ltnp || netstat -ltnp || true) 2>&1 | tail -n 80"]),
    log: await rodar("tail", ["-n", "100", "/vercel/worker.log"]),
  };

  console.log("[MONITOR DIAG]", JSON.stringify(diagnostico));

  return <pre>{JSON.stringify(diagnostico, null, 2)}</pre>;
}
