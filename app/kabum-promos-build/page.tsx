import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-static";

export default async function KabumPromosBuildPage() {
  try {
    const sandbox = await Sandbox.get({
      name: process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test",
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase nao configurado no build.");

    await sandbox.runCommand({ cmd: "mkdir", args: ["-p", "/vercel/scripts", "/vercel/tmp"], cwd: "/vercel" });

    for (const arquivo of ["selecionar-promocoes-kabum-awin.cjs", "publicar-promocoes-kabum-awin.cjs"]) {
      const download = await sandbox.runCommand({
        cmd: "curl",
        args: [
          "-fsSL",
          "--max-time",
          "30",
          `https://raw.githubusercontent.com/gabrielcalvi/achados-do-casal/main/scripts/${arquivo}`,
          "-o",
          `/vercel/scripts/${arquivo}`,
        ],
        cwd: "/vercel",
      });
      if (download.exitCode !== 0) throw new Error(`Falha sincronizando ${arquivo}`);
    }

    const gravarEnv = await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        "printf 'NEXT_PUBLIC_SUPABASE_URL=%s\\nSUPABASE_SERVICE_ROLE_KEY=%s\\n' \"$SB_URL\" \"$SB_KEY\" > /vercel/.env.local && chmod 600 /vercel/.env.local",
      ],
      cwd: "/vercel",
      env: {
        SB_URL: supabaseUrl,
        SB_KEY: serviceKey,
      },
    });
    if (gravarEnv.exitCode !== 0) throw new Error("Falha criando env temporario no Sandbox.");

    const selecao = await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/scripts/selecionar-promocoes-kabum-awin.cjs"],
      cwd: "/vercel",
      env: {
        KABUM_PROMOCOES_MAX_PUBLICAR: "40",
        KABUM_PROMOCOES_MAX_POR_GRUPO: "6",
      },
    });
    const saidaSelecao = `${await selecao.stdout()}\n${await selecao.stderr()}`.trim();
    console.log("[KABUM PROMOS SELECAO]", saidaSelecao);
    if (selecao.exitCode !== 0) throw new Error("Selecao ampliada KaBuM falhou.");

    const publicacao = await sandbox.runCommand({
      cmd: "node",
      args: ["/vercel/scripts/publicar-promocoes-kabum-awin.cjs", "CONFIRMAR"],
      cwd: "/vercel",
    });
    const saidaPublicacao = `${await publicacao.stdout()}\n${await publicacao.stderr()}`.trim();
    console.log("[KABUM PROMOS PUBLICACAO]", saidaPublicacao);
    if (publicacao.exitCode !== 0) throw new Error("Publicacao ampliada KaBuM falhou.");

    await sandbox.runCommand({ cmd: "rm", args: ["-f", "/vercel/.env.local"], cwd: "/vercel" });
  } catch (erro) {
    console.log("[KABUM PROMOS BUILD ERRO]", erro instanceof Error ? erro.message : String(erro));
  }

  return <main>Carga temporária de promoções KaBuM.</main>;
}
