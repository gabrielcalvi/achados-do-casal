import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SANDBOX_NAME = process.env.KABUM_AWIN_SANDBOX_NAME || "achados-cupons-ml-test";
const REPOSITORY = "gabrielcalvi/achados-do-casal";
const SCRIPT_PATH = "/vercel/scripts/varrer-produtos-awin-legacy.cjs";
const WRAPPER_PATH = "/vercel/scripts/varrer-produtos-awin-legacy-wrapper.cjs";
const CONFIG_PATH = "/vercel/scripts/awin-lojas.config.cjs";
const STATUS_PATH = "/vercel/tmp/awin-produtos-cobasi-status.json";
const RESULT_PATH = "/vercel/tmp/awin-produtos-cobasi-resultado.json";
const LOG_PATH = "/vercel/tmp/awin-produtos-cobasi.log";
const EXIT_PATH = "/vercel/tmp/awin-produtos-cobasi-exit.txt";

type SandboxInstancia = Awaited<ReturnType<typeof Sandbox.get>>;

async function usuarioAutenticado() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && Boolean(user);
  } catch { return false; }
}

function autorizadoComoCron(request: NextRequest) {
  const segredo = process.env.CRON_SECRET?.trim() || "";
  return Boolean(segredo) && request.headers.get("authorization") === `Bearer ${segredo}`;
}

async function autorizado(request: NextRequest) {
  return autorizadoComoCron(request) || usuarioAutenticado();
}

async function comando(sandbox: SandboxInstancia, cmd: string, args: string[], env?: Record<string, string>) {
  const resultado = await sandbox.runCommand({ cmd, args, cwd: "/vercel", env });
  const stdout = (await resultado.stdout()).trim();
  const stderr = (await resultado.stderr()).trim();
  return { resultado, stdout, stderr };
}

async function lerJson(sandbox: SandboxInstancia, caminho: string) {
  const leitura = await comando(sandbox, "cat", [caminho]);
  if (leitura.resultado.exitCode !== 0 || !leitura.stdout) return null;
  try { return JSON.parse(leitura.stdout) as Record<string, unknown>; } catch { return null; }
}

async function status(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });
  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    const dados = (await lerJson(sandbox, STATUS_PATH)) || (await lerJson(sandbox, RESULT_PATH)) || { executando: false };
    const log = await comando(sandbox, "tail", ["-n", "120", LOG_PATH]);
    return NextResponse.json({ sucesso: true, status: dados, log: log.stdout || null });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

async function executar(request: NextRequest) {
  if (!(await autorizado(request))) return NextResponse.json({ sucesso: false, erro: "Nao autorizado." }, { status: 401 });

  const awinToken = process.env.AWIN_API_TOKEN;
  const datafeedKey = process.env.AWIN_DATAFEED_API_KEY;
  const publisher = process.env.AWIN_PUBLISHER_ID || "2922231";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!awinToken || !datafeedKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ sucesso: false, erro: "Variaveis AWIN/Data Feed/Supabase incompletas." }, { status: 500 });
  }

  try {
    const sandbox = await Sandbox.get({ name: SANDBOX_NAME });
    await comando(sandbox, "mkdir", ["-p", "/vercel/scripts", "/vercel/tmp"]);
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "main";
    const arquivos = [
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy.cjs`, SCRIPT_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/varrer-produtos-awin-legacy-wrapper.cjs`, WRAPPER_PATH],
      [`https://raw.githubusercontent.com/${REPOSITORY}/${encodeURIComponent(commit)}/scripts/awin-lojas.config.cjs`, CONFIG_PATH],
    ];
    for (const [url, destino] of arquivos) {
      const dl = await comando(sandbox, "curl", ["-fsSL", "--max-time", "30", url, "-o", destino]);
      if (dl.resultado.exitCode !== 0) throw new Error(dl.stderr || `Falha sincronizando ${destino}.`);
    }

    const patchScript = `
const fs=require('fs');
const p=${JSON.stringify(SCRIPT_PATH)};
let c=fs.readFileSync(p,'utf8');
c=c.replace('Math.min(30, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))','Math.min(300, Number(process.env.AWIN_PRODUTOS_LIMITE_POR_LOJA || 15))');
c=c.replace('["cea", "renner", "calvin-klein", "stanley", "casas-bahia"]','["cea", "renner", "calvin-klein", "stanley", "casas-bahia", "cobasi"]');
c=c.replace('/vercel/tmp/awin-produtos-status.json',${JSON.stringify(STATUS_PATH)}).replace('/vercel/tmp/awin-produtos-resultado.json',${JSON.stringify(RESULT_PATH)}).replace('AbortSignal.timeout(240000)','AbortSignal.timeout(900000)');

const marcador='async function gerarLinksAfiliados(loja, produtos) {';
const helpers='function textoCobasi(produto) {\\n  return String((produto.titulo || "") + " " + (produto.categoria || "") + " " + (produto.marca || "")).toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");\\n}\\n\\nfunction grupoCobasi(produto) {\\n  const t = textoCobasi(produto);\\n  if (t.includes("friskies gatos adultos")) return "bloquear";\\n  if (["coleira", "peitoral", "guia ", "guia para", "cinto de seguranca", "passeio"].some((v) => t.includes(v))) return "passeio";\\n  if (["brinquedo", "mordedor", "bolinha", "arranhador", "pelucia", "varinha"].some((v) => t.includes(v))) return "brinquedos";\\n  if (["tapete higienico", "areia", "granulado", "shampoo", "condicionador", "higiene", "limpador", "escova", "pente", "banho", "eliminador", "sanitario"].some((v) => t.includes(v))) return "higiene";\\n  if (["petisco", "bifinho", "snack", "osso", "biscoito", "palito", "dentastix"].some((v) => t.includes(v))) return "petiscos";\\n  if (["sache", "racao umida", "pate", "ao molho", "molho -"].some((v) => t.includes(v))) return "umidos";\\n  if (["racao", "alimento seco"].some((v) => t.includes(v))) return "racao_seca";\\n  if (["comedouro", "bebedouro", "cama", "casinha", "caixa de transporte", "transportadora", "pote", "fonte", "tapete coletor", "roupa", "roupinha"].some((v) => t.includes(v))) return "acessorios";\\n  return "outros";\\n}\\n\\nfunction categoriaCobasi(produto) {\\n  const grupo = grupoCobasi(produto);\\n  return ({ racao_seca: "Ração", umidos: "Ração úmida", petiscos: "Petiscos", higiene: "Higiene", passeio: "Passeio", brinquedos: "Brinquedos", acessorios: "Acessórios", outros: "Pet" })[grupo] || "Pet";\\n}\\n\\nfunction selecionarDiversificadoCobasi(produtos, limite) {\\n  const ordem = ["racao_seca", "higiene", "passeio", "brinquedos", "petiscos", "acessorios", "outros", "umidos"];\\n  const validos = produtos.filter((produto) => grupoCobasi(produto) !== "bloquear" && produto.imagem);\\n  const grupos = new Map(ordem.map((grupo) => [grupo, []]));\\n  for (const produto of validos) {\\n    const grupo = grupoCobasi(produto);\\n    if (!grupos.has(grupo)) grupos.set(grupo, []);\\n    grupos.get(grupo).push(produto);\\n  }\\n  for (const lista of grupos.values()) lista.sort(ordenarProdutos);\\n  const saida = [];\\n  const usados = new Set();\\n  let indice = 0;\\n  while (saida.length < limite) {\\n    let adicionou = false;\\n    for (const grupo of ordem) {\\n      const lista = grupos.get(grupo) || [];\\n      const produto = lista[indice];\\n      if (!produto) continue;\\n      const chave = String(produto.id || produto.link || produto.titulo);\\n      if (usados.has(chave)) continue;\\n      usados.add(chave);\\n      saida.push({ ...produto, categoria: categoriaCobasi(produto) });\\n      adicionou = true;\\n      if (saida.length >= limite) break;\\n    }\\n    if (!adicionou) break;\\n    indice += 1;\\n  }\\n  if (saida.length < limite) {\\n    for (const produto of [...validos].sort(ordenarProdutos)) {\\n      const chave = String(produto.id || produto.link || produto.titulo);\\n      if (usados.has(chave)) continue;\\n      usados.add(chave);\\n      saida.push({ ...produto, categoria: categoriaCobasi(produto) });\\n      if (saida.length >= limite) break;\\n    }\\n  }\\n  return saida.slice(0, limite);\\n}\\n\\n';

c=c.replace('selecionados: top.slice(0, LIMITE_POR_LOJA),','selecionados: loja.slug === "cobasi" ? selecionarDiversificadoCobasi(top, LIMITE_POR_LOJA) : top.slice(0, LIMITE_POR_LOJA),');
const direto=helpers+'function linkAfiliadoCobasiDireto(loja, destino) {\\n  const params = new URLSearchParams({ awinmid: String(loja.advertiserId), awinaffid: PUBLISHER_ID, campaign: "achados-economize-produtos", ued: destino, platform: "pl" });\\n  return "https://www.awin1.com/cread.php?" + params.toString();\\n}\\n\\nasync function gerarLinksAfiliados(loja, produtos) {\\n  if (loja.slug === "cobasi") {\\n    const prontos = selecionarDiversificadoCobasi(produtos, LIMITE_POR_LOJA).map((produto) => ({ ...produto, linkAfiliado: linkAfiliadoCobasiDireto(loja, produto.link) }));\\n    return { produtos: prontos, falhas: 0, nativos: prontos.length };\\n  }';
if(!c.includes(marcador)) throw new Error('Gerador de links afiliados nao encontrado para Cobasi.');
c=c.replace(marcador,direto);
fs.writeFileSync(p,c);
`;

    const patch = await comando(sandbox, "node", ["-e", patchScript]);
    if (patch.resultado.exitCode !== 0) throw new Error(patch.stderr || "Falha preparando coletor Cobasi.");

    await comando(sandbox, "rm", ["-f", LOG_PATH, EXIT_PATH]);
    const env = {
      AWIN_API_TOKEN: awinToken,
      AWIN_DATAFEED_API_KEY: datafeedKey,
      AWIN_PUBLISHER_ID: publisher,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      AWIN_PRODUTOS_LOJAS: "cobasi",
      AWIN_PRODUTOS_LIMITE_POR_LOJA: "240",
      AWIN_PRODUTOS_DESCONTO_MINIMO: "10",
      AWIN_PRODUTOS_CATALOGO_LOJAS: "cobasi",
    };

    await sandbox.runCommand({
      cmd: "sh",
      args: ["-lc", `node ${WRAPPER_PATH} CONFIRMAR > ${LOG_PATH} 2>&1; echo $? > ${EXIT_PATH}`],
      cwd: "/vercel",
      env,
      detached: true,
    });

    return NextResponse.json({ sucesso: true, iniciado: true, loja: "cobasi", advertiser_id: "17870", feed_id: "48117", limite: 240, categoria: "Pet diversificado", tracking: "awin_direto", iniciadoEm: new Date().toISOString() }, { status: 202 });
  } catch (erro) {
    return NextResponse.json({ sucesso: false, erro: erro instanceof Error ? erro.message : String(erro) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "1") return status(request);
  return executar(request);
}
export async function POST(request: NextRequest) { return executar(request); }
