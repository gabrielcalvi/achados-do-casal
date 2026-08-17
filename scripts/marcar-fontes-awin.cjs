const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const lojas = require("./awin-lojas.config.cjs");

function carregarEnv() {
  const arquivo = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(arquivo)) {
    return;
  }

  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const texto = linha.trim();

    if (!texto || texto.startsWith("#")) {
      continue;
    }

    const p = texto.indexOf("=");

    if (p < 1) {
      continue;
    }

    const chave = texto.slice(0, p).trim();
    let valor = texto.slice(p + 1).trim();

    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    if (!process.env[chave]) {
      process.env[chave] = valor;
    }
  }
}

carregarEnv();

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Credenciais Supabase nao encontradas.");
}

const supabase = createClient(
  supabaseUrl,
  serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function main() {
  const agora = new Date().toISOString();
  const slugs = lojas.map((loja) => loja.dbSlug);

  if (!slugs.length) {
    console.log("Nenhuma loja Awin configurada para marcar.");
    return;
  }

  const { data: lojasBanco, error: erroLojas } = await supabase
    .from("economize_lojas")
    .select("id,slug")
    .in("slug", slugs);

  if (erroLojas) {
    throw erroLojas;
  }

  for (const loja of lojasBanco || []) {
    const { data: fontes, error: erroFontes } = await supabase
      .from("economize_fontes")
      .select("id,intervalo_minutos,configuracao")
      .eq("loja_id", loja.id)
      .eq("ativa", true);

    if (erroFontes) {
      throw erroFontes;
    }

    for (const fonte of fontes || []) {
      if (fonte.configuracao?.provedor !== "awin") {
        continue;
      }

      const intervalo = Number(fonte.intervalo_minutos || 360);
      const proxima = new Date(
        Date.now() + intervalo * 60 * 1000
      ).toISOString();

      const { error } = await supabase
        .from("economize_fontes")
        .update({
          ultima_execucao_em: agora,
          proxima_execucao_em: proxima,
          updated_at: agora
        })
        .eq("id", fonte.id);

      if (error) {
        throw error;
      }

      console.log(`Fonte Awin marcada: ${loja.slug}`);
    }
  }
}

main().catch((erro) => {
  console.error("ERRO:", erro.message || erro);
  process.exit(1);
});
