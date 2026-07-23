import { loadEnvFile } from "node:process";

loadEnvFile(".env.local");

async function main() {
  const { supabaseAdmin } = await import(
    "@/lib/supabase/admin"
  );

  const { data, error } = await supabaseAdmin
    .from("monitor_alteracoes")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Erro na conexão:", error);
    process.exitCode = 1;
    return;
  }

  console.log("Conexão OK!");
  console.log(data);
}

main().catch((error) => {
  console.error("Erro inesperado:", error);
  process.exitCode = 1;
});