import { load } from "cheerio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gerarDeeplinkLomadee } from "@/lib/lomadee/api";

const TERABYTE_ORG_ID = "7ca3d59d-fd91-4759-82f4-cc4f4ce65d42";
const TERABYTE_LOJA_SLUG = "terabyte";
const ORIGEM = "agente_produtos_terabyte";
const LIMITE_PUBLICACAO = 120;

type ProdutoTera = {
  id: string;
  titulo: string;
  url: string;
  imagem: string;
  categoria: string;
  precoOriginal: number | null;
  precoOferta: number;
  desconto: number | null;
  freteGratis: boolean;
  ranking: string | null;
  parcelamento: string | null;
};

function parseMoeda(valor: string | null | undefined) {
  if (!valor) return null;
  const numero = valor.replace(/R\$/gi, "").replace(/\s+/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(numero);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function limparTexto(valor: string | null | undefined) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

async function baixar(url: string) {
  const resposta = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!resposta.ok) throw new Error(`TeraByte respondeu HTTP ${resposta.status}: ${url}`);
  return resposta.text();
}

async function descobrirCategorias() {
  const html = await baixar("https://www.terabyteshop.com.br/ofertas");
  const $ = load(html);
  const categorias: Array<{ nome: string; url: string }> = [];
  $("a.cat").each((_, el) => {
    const url = $(el).attr("href")?.trim() || "";
    const nome = limparTexto($(el).find("h3").first().text());
    if (url.startsWith("https://www.terabyteshop.com.br/ofertas/") && nome) categorias.push({ nome, url });
  });
  return categorias;
}

function extrairProdutos(html: string, categoria: string) {
  const $ = load(html);
  const produtos: ProdutoTera[] = [];
  $(".product-item").each((_, el) => {
    const card = $(el);
    const linkEl = card.find("a.product-item__name").first();
    const url = linkEl.attr("href")?.trim() || card.find("a.product-item__image").first().attr("href")?.trim() || "";
    const titulo = limparTexto(linkEl.attr("title") || linkEl.text());
    const idMatch = url.match(/\/produto\/(\d+)\//i);
    const imagem = card.find("img.image-thumbnail").first().attr("src")?.trim() || card.find("a.product-item__image img").first().attr("src")?.trim() || "";
    const precoOriginal = parseMoeda(card.find(".product-item__old-price span").first().text());
    const precoOferta = parseMoeda(card.find(".product-item__new-price span").first().text());
    const freteGratis = /frete gr[aá]tis/i.test(card.text());
    const ranking = limparTexto(card.find(".maisV").first().text()) || null;
    const parcelamento = limparTexto(card.find(".product-item__juros").first().text()) || null;
    if (!idMatch?.[1] || !titulo || !url || !imagem || !precoOferta) return;
    if (!url.startsWith("https://www.terabyteshop.com.br/")) return;
    let desconto: number | null = null;
    if (precoOriginal && precoOriginal > precoOferta) desconto = Math.round(((precoOriginal - precoOferta) / precoOriginal) * 1000) / 10;
    produtos.push({ id:idMatch[1], titulo, url, imagem:imagem.replace(/^http:\/\//i,"https://"), categoria, precoOriginal, precoOferta, desconto, freteGratis, ranking, parcelamento });
  });
  return produtos;
}

function selecionarDiversificado(produtos: ProdutoTera[], limite: number) {
  const porCategoria = new Map<string, ProdutoTera[]>();
  for (const produto of produtos) {
    const lista = porCategoria.get(produto.categoria) || [];
    lista.push(produto);
    porCategoria.set(produto.categoria, lista);
  }
  for (const lista of porCategoria.values()) lista.sort((a,b)=>(b.desconto||0)-(a.desconto||0)||a.precoOferta-b.precoOferta);
  const categorias = Array.from(porCategoria.keys());
  const selecionados: ProdutoTera[] = [];
  let indice=0;
  while (selecionados.length<limite) {
    let adicionou=false;
    for (const categoria of categorias) {
      const produto=porCategoria.get(categoria)?.[indice];
      if (!produto) continue;
      selecionados.push(produto); adicionou=true;
      if (selecionados.length>=limite) break;
    }
    if (!adicionou) break;
    indice+=1;
  }
  return selecionados;
}

async function mapearComConcorrencia<T,R>(itens:T[], limite:number, fn:(item:T)=>Promise<R>) {
  const resultados:R[]=new Array(itens.length); let cursor=0;
  async function worker(){while(true){const indice=cursor++; if(indice>=itens.length)return; resultados[indice]=await fn(itens[indice]);}}
  await Promise.all(Array.from({length:Math.min(limite,itens.length)},()=>worker()));
  return resultados;
}

export async function sincronizarCatalogoTerabyte() {
  const inicio=Date.now();
  const categorias=await descobrirCategorias();
  if (!categorias.length) throw new Error("TeraByte não retornou categorias de ofertas.");
  const paginas=await mapearComConcorrencia(categorias,4,async(categoria)=>{
    try{return extrairProdutos(await baixar(categoria.url),categoria.nome);}catch(erro){console.error("[TeraByte] Falha em categoria",categoria.nome,erro);return [] as ProdutoTera[];}
  });
  const unicos=new Map<string,ProdutoTera>();
  for(const produto of paginas.flat()){const atual=unicos.get(produto.id); if(!atual||(produto.desconto||0)>(atual.desconto||0)) unicos.set(produto.id,produto);}
  const selecionados=selecionarDiversificado(Array.from(unicos.values()),LIMITE_PUBLICACAO);
  if(!selecionados.length) throw new Error("Nenhum produto TeraByte elegível foi encontrado.");

  const {data:loja,error:erroLoja}=await supabaseAdmin.from("economize_lojas").select("id").eq("slug",TERABYTE_LOJA_SLUG).eq("ativa",true).single();
  if(erroLoja||!loja?.id) throw new Error(`Loja TeraByte não encontrada: ${erroLoja?.message||"sem id"}`);

  const {data:existentes,error:erroExistentes}=await supabaseAdmin.from("economize_ofertas").select("id,dedupe_key,link_afiliado").eq("loja_id",loja.id).eq("origem",ORIGEM);
  if(erroExistentes) throw new Error(erroExistentes.message);
  const existentesPorDedupe=new Map((existentes||[]).map(item=>[String(item.dedupe_key||""),item]));

  let falhasDeeplink=0;
  const agora=new Date().toISOString();
  const preparados=await mapearComConcorrencia(selecionados,6,async(produto)=>{
    const dedupe=`terabyte:produto:${produto.id}`;
    const existente=existentesPorDedupe.get(dedupe);
    let linkAfiliado=typeof existente?.link_afiliado==="string"&&existente.link_afiliado.trim()?existente.link_afiliado.trim():"";
    if(!linkAfiliado){
      try{linkAfiliado=await gerarDeeplinkLomadee(produto.url,TERABYTE_ORG_ID,`produto-terabyte-${produto.id}`);}
      catch(erro){falhasDeeplink+=1;console.error("[TeraByte] Falha deeplink",produto.id,erro);}
    }
    if(!linkAfiliado)return null;
    const economia=produto.precoOriginal&&produto.precoOriginal>produto.precoOferta?Math.round((produto.precoOriginal-produto.precoOferta)*100)/100:null;
    return {
      loja_id:loja.id,tipo:"promocao",status:"ativo",titulo:produto.titulo,
      descricao:`Produto TeraByte em ${produto.categoria}, com preço atualizado automaticamente pelo Achados do Casal.`,
      codigo:null,categoria:produto.categoria,regras:"Preço consultado diretamente na TeraByte. Valor e disponibilidade podem mudar sem aviso.",
      imagem_url:produto.imagem,link_destino:produto.url,link_afiliado:linkAfiliado,desconto_percentual:produto.desconto,
      valor_desconto:economia,cashback_percentual:null,pedido_minimo:null,preco_original:produto.precoOriginal,preco_oferta:produto.precoOferta,
      data_inicio:null,validade:null,destaque:(produto.desconto||0)>=25,
      selos:["TERABYTE","LOMADEE","PREÇO AUTOMÁTICO",...(produto.freteGratis?["FRETE GRÁTIS"]:[])],
      origem:ORIGEM,origem_url:produto.url,dedupe_key:dedupe,
      dados_brutos:{provider_catalogo:"terabyte_site",provider_afiliado:"lomadee",terabyte_product_id:produto.id,categoria_fonte:produto.categoria,frete_gratis:produto.freteGratis,ranking:produto.ranking,parcelamento:produto.parcelamento,commission_percent:1.5,organization_id:TERABYTE_ORG_ID},
      coletado_em:agora,verificado_em:agora,updated_at:agora
    };
  });
  const publicaveis=preparados.filter((item):item is NonNullable<typeof item>=>Boolean(item));
  if(!publicaveis.length) throw new Error("Nenhum produto TeraByte ficou com deeplink monetizado.");
  const {error:erroUpsert}=await supabaseAdmin.from("economize_ofertas").upsert(publicaveis,{onConflict:"loja_id,dedupe_key"});
  if(erroUpsert) throw new Error(erroUpsert.message);
  const dedupesAtivos=publicaveis.map(item=>item.dedupe_key);
  const idsDesativar=(existentes||[]).filter(item=>item.dedupe_key&&!dedupesAtivos.includes(item.dedupe_key)).map(item=>item.id);
  if(idsDesativar.length){
    const {error}=await supabaseAdmin.from("economize_ofertas").update({status:"inativo",updated_at:agora}).in("id",idsDesativar);
    if(error) throw new Error(error.message);
  }
  return {sucesso:true,categorias:categorias.length,produtos_encontrados:unicos.size,produtos_publicados:publicaveis.length,deeplinks_falharam:falhasDeeplink,desativados:idsDesativar.length,duracao_ms:Date.now()-inicio,atualizado_em:agora};
}
