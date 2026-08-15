"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CapturaDecolar = {
  link_original?: string;
  titulo?: string;
  origem_codigo?: string;
  destino_codigo?: string;
  destino_nome?: string;
  data_ida?: string;
  data_volta?: string;
  noites?: number | null;
  hotel_nome?: string;
  hotel_categoria?: string;
  regime_hospedagem?: string;
  adultos?: number;
  criancas?: number;
  companhia_aerea?: string;
  bagagem?: string;
  preco_total?: number | null;
  preco_por_pessoa?: number | null;
  imagem_url?: string;
  observacoes?: string;
  campos_detectados?: string[];
};

function decodificarPayload(valor: string) {
  const bytes = Uint8Array.from(atob(valor), (caractere) =>
    caractere.charCodeAt(0)
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as CapturaDecolar;
}

function definirValor(elemento: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, valor: string) {
  if (elemento instanceof HTMLSelectElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    )?.set;
    setter?.call(elemento, valor);
  } else if (elemento instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(elemento, valor);
  } else {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(elemento, valor);
  }

  elemento.dispatchEvent(new Event("input", { bubbles: true }));
  elemento.dispatchEvent(new Event("change", { bubbles: true }));
}

function localizarCampo(rotulo: string) {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => {
    const span = item.querySelector("span");
    const texto = span?.textContent?.replace(/\s+/g, " ").trim() || "";
    return texto === rotulo || texto === `${rotulo} *`;
  });

  return label?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input, textarea, select"
  ) ?? null;
}

function preencherCampo(rotulo: string, valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return false;
  const campo = localizarCampo(rotulo);
  if (!campo) return false;
  definirValor(campo, String(valor));
  return true;
}

async function garantirFormularioAberto() {
  if (document.querySelector('input[placeholder="https://www.decolar.com/..."]')) {
    return true;
  }

  const botao = Array.from(document.querySelectorAll("button")).find((item) =>
    item.textContent?.includes("Adicionar pacote")
  );
  botao?.click();

  for (let tentativa = 0; tentativa < 24; tentativa += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (document.querySelector('input[placeholder="https://www.decolar.com/..."]')) {
      return true;
    }
  }

  return false;
}

async function aplicarNoFormulario(dados: CapturaDecolar) {
  const aberto = await garantirFormularioAberto();
  if (!aberto) {
    throw new Error("Não encontrei o formulário de Pacotes para aplicar a captura.");
  }

  const linkOriginal = document.querySelector<HTMLInputElement>(
    'input[placeholder="https://www.decolar.com/..."]'
  );
  if (linkOriginal && dados.link_original) {
    definirValor(linkOriginal, dados.link_original);
  }

  preencherCampo("Título do pacote", dados.titulo);
  preencherCampo("Origem", dados.origem_codigo);
  preencherCampo("Destino", dados.destino_codigo);
  preencherCampo("Nome do destino", dados.destino_nome);
  preencherCampo("Ida", dados.data_ida);
  preencherCampo("Volta", dados.data_volta);
  preencherCampo("Noites", dados.noites);
  preencherCampo("Hotel", dados.hotel_nome);
  preencherCampo("Categoria hotel", dados.hotel_categoria);
  preencherCampo("Regime", dados.regime_hospedagem);
  preencherCampo("Companhia aérea", dados.companhia_aerea);
  preencherCampo("Bagagem", dados.bagagem);
  preencherCampo("Adultos", dados.adultos);
  preencherCampo("Crianças", dados.criancas);
  preencherCampo("Preço total", dados.preco_total);
  preencherCampo("Preço por pessoa", dados.preco_por_pessoa);
  preencherCampo("Imagem", dados.imagem_url);
  preencherCampo("Observações", dados.observacoes);

  document
    .querySelector('input[placeholder="https://www.decolar.com/..."]')
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function criarBookmarklet(adminBase: string) {
  const script = `(()=>{try{const clean=v=>String(v??'').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim();const num=v=>{const s=clean(v).replace(/[^\\d.,]/g,'');if(!s)return null;const n=Number(s.includes(',')?s.replace(/\\./g,'').replace(',','.'):s);return Number.isFinite(n)?n:null};const text=clean(document.body?.innerText||'');const url=new URL(location.href);let decoded='';try{const raw=url.searchParams.get('searchParams')||'';decoded=raw?atob(raw.replace(/-/g,'+').replace(/_/g,'/')):''}catch{}const dates=(decoded+' '+url.pathname).match(/\\d{4}-\\d{2}-\\d{2}/g)||[];const nightsText=text.match(/(\\d+)\\s*Dias?\\s*\\/\\s*(\\d+)\\s*Noites?/i);let nights=nightsText?Number(nightsText[2]):null;if(!nights&&dates[0]&&dates[1]){const a=Date.parse(dates[0]+'T12:00:00Z'),b=Date.parse(dates[1]+'T12:00:00Z');if(b>a)nights=Math.round((b-a)/86400000)}let hotel=null;const visit=o=>{if(!o||hotel)return;if(Array.isArray(o)){o.forEach(visit);return}if(typeof o!=='object')return;const t=Array.isArray(o['@type'])?o['@type']:[o['@type']];if(t.some(x=>['Hotel','LodgingBusiness','Resort','Hostel','Accommodation'].includes(String(x)))&&o.name){hotel=o;return}if(o['@graph'])visit(o['@graph'])};document.querySelectorAll('script[type="application/ld+json"]').forEach(el=>{try{visit(JSON.parse(el.textContent||''))}catch{}});const heads=[...document.querySelectorAll('h1,h2,h3,h4')].map(e=>clean(e.textContent)).filter(Boolean);const hotelName=clean(hotel?.name)||heads.find(h=>h.length>3&&h.length<160&&!/decolar|despegar|pacote|detalhes|resumo|escolha|voo|a[eé]reo|pre[cç]o/i.test(h))||'';const imgValue=Array.isArray(hotel?.image)?hotel.image[0]:hotel?.image;const img=clean(typeof imgValue==='string'?imgValue:imgValue?.url)||clean(document.querySelector('meta[property="og:image"]')?.getAttribute('content'))||clean(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'))||[...document.images].map(i=>({u:i.currentSrc||i.src,a:(i.naturalWidth||i.width)*(i.naturalHeight||i.height)})).filter(i=>/^https?:/i.test(i.u)).sort((a,b)=>b.a-a.a)[0]?.u||'';const route=text.match(/\\b([A-Z]{3})\\s*(?:-|→|–)\\s*([A-Z]{3})\\b/);const origin=route?.[1]||'';const dest=route?.[2]||'';const city=clean(hotel?.address?.addressLocality)||clean(text.match(/(?:Destino|Para|Estadia em)\\s+([A-Za-zÀ-ÿ' -]{2,60})/i)?.[1])||'';const per=num(text.match(/Pre[cç]o por pessoa(?: a partir de)?\\s*R\\$\\s*([\\d.]+(?:,\\d{1,2})?)/i)?.[1]||text.match(/R\\$\\s*([\\d.]+(?:,\\d{1,2})?)\\s*(?:por pessoa|\\/\\s*pessoa)/i)?.[1]);let total=num(text.match(/(?:Pre[cç]o total|Total|Final)[^R]{0,100}R\\$\\s*([\\d.]+(?:,\\d{1,2})?)/i)?.[1]);let adults=Number(url.searchParams.get('adults')||'');let children=Number(url.searchParams.get('children')||'');if(!Number.isFinite(adults)||adults<1){const m=decoded.match(/\\/(\\d+)\\|/);adults=m?Number(m[1]):2}if(!Number.isFinite(children)||children<0)children=0;if(!total&&per&&adults>0&&children===0)total=Number((per*adults).toFixed(2));const airlines=['LATAM','GOL','Azul','Air China','American Airlines','United Airlines','Delta','Copa Airlines','Avianca','TAP','Iberia','Air Europa','Turkish Airlines','Emirates','Qatar Airways','Air France','KLM','Lufthansa'];const airline=airlines.find(n=>text.toLowerCase().includes(n.toLowerCase()))||'';const bags=[];if(/mochila ou bolsa/i.test(text))bags.push('mochila/bolsa');if(/bagagem de m[aã]o/i.test(text))bags.push('bagagem de mão');if(/bagagem para despachar|bagagem despachada|23\\s*kg/i.test(text))bags.push('bagagem despachada');else if(/n[aã]o inclui bagagem para despachar/i.test(text))bags.push('sem bagagem despachada');const regime=/all.?inclusive/i.test(text)?'All inclusive':/caf[eé]\\s+da\\s+manh[aã]|breakfast/i.test(text)?'Café da manhã':'';const star=clean(hotel?.starRating?.ratingValue)||clean(text.match(/([1-5])\\s*estrelas?/i)?.[1]);const category=star?star+' estrelas':'';const fields=[];const add=(k,v)=>{if(v!==null&&v!==undefined&&v!=='')fields.push(k)};add('hotel',hotelName);add('datas',dates[0]&&dates[1]);add('noites',nights);add('preço',per||total);add('imagem',img);add('rota',origin&&dest);add('companhia',airline);add('bagagem',bags.length);const title=hotelName?(city?hotelName+' • '+city:hotelName):(city&&nights?city+' • '+nights+' noites + aéreo + hotel':'Pacote Decolar • aéreo + hotel');const data={link_original:location.href,titulo:title,origem_codigo:origin,destino_codigo:dest,destino_nome:city,data_ida:dates[0]||'',data_volta:dates[1]||'',noites:nights,hotel_nome:hotelName,hotel_categoria:category,regime_hospedagem:regime,adultos:adults,criancas:children,companhia_aerea:airline,bagagem:bags.join(' • '),preco_total:total,preco_por_pessoa:per,imagem_url:img,observacoes:'Capturado diretamente da página aberta da Decolar no navegador. Revise os campos antes de publicar.',campos_detectados:fields};const bytes=new TextEncoder().encode(JSON.stringify(data));let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));const payload=btoa(bin);location.href='${adminBase}?decolar_capture='+encodeURIComponent(payload)}catch(e){alert('Não foi possível capturar este pacote da Decolar: '+(e?.message||e))}})()`;

  return `javascript:${script}`;
}

export default function CapturadorDecolarLocal() {
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const [bookmarklet, setBookmarklet] = useState("");
  const [captura, setCaptura] = useState<CapturaDecolar | null>(null);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const codigo = criarBookmarklet(base);
    setBookmarklet(codigo);
    linkRef.current?.setAttribute("href", codigo);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = params.get("decolar_capture");
    if (!payload) return;

    try {
      const dados = decodificarPayload(payload);
      setCaptura(dados);
      setStatus(
        `Captura recebida da Decolar: ${dados.campos_detectados?.length ?? 0} grupo(s) de dados encontrados.`
      );

      const url = new URL(window.location.href);
      url.searchParams.delete("decolar_capture");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

      window.setTimeout(() => {
        void aplicarNoFormulario(dados)
          .then(() =>
            setStatus(
              `Captura aplicada ao formulário: ${dados.campos_detectados?.length ?? 0} grupo(s) encontrados. Revise e cole o link afiliado.`
            )
          )
          .catch((error) =>
            setErro(error instanceof Error ? error.message : "Falha ao aplicar captura.")
          );
      }, 400);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "A captura recebida da Decolar é inválida."
      );
    }
  }, []);

  const campos = useMemo(
    () => captura?.campos_detectados?.join(", ") || "",
    [captura]
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setStatus(
        "Código do capturador copiado. Crie um favorito no navegador e cole esse código no campo de endereço do favorito."
      );
      setErro("");
    } catch {
      setErro("Não consegui copiar automaticamente. Arraste o botão para a barra de favoritos.");
    }
  }

  async function reaplicar() {
    if (!captura) return;
    try {
      await aplicarNoFormulario(captura);
      setStatus("Captura reaplicada ao formulário. Revise os campos antes de salvar.");
      setErro("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao reaplicar captura.");
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-cyan-700">
            📥 Captura direta da Decolar
          </p>
          <h2 className="mt-2 text-2xl font-black">Use a página que já abriu no seu navegador</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Esta opção não usa Railway, Monitor, Mercado Livre nem navegador serverless.
            Ela lê o pacote diretamente da página da Decolar aberta no seu Chrome e volta
            para este Admin com os campos encontrados.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            ref={linkRef}
            href="#"
            onClick={(evento) => evento.preventDefault()}
            className="cursor-grab rounded-xl bg-cyan-700 px-5 py-3 text-center font-black text-white"
            title="Arraste este botão para a barra de favoritos"
          >
            📥 Capturar pacote Decolar
          </a>
          <button
            type="button"
            onClick={copiar}
            disabled={!bookmarklet}
            className="rounded-xl border border-cyan-300 bg-cyan-50 px-5 py-3 font-black text-cyan-900 disabled:opacity-50"
          >
            Copiar código
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">1. Instalar uma vez</p>
          <p className="mt-2 text-sm font-bold text-slate-700">
            Arraste “Capturar pacote Decolar” para a barra de favoritos do Chrome.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">2. Na Decolar</p>
          <p className="mt-2 text-sm font-bold text-slate-700">
            Abra o pacote completo e clique nesse favorito enquanto estiver na página da Decolar.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">3. Revisar</p>
          <p className="mt-2 text-sm font-bold text-slate-700">
            O Admin abre de novo, preenche o cadastro atual e mantém o link afiliado separado.
          </p>
        </div>
      </div>

      {status && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {status}
          {campos ? ` Campos: ${campos}.` : ""}
        </div>
      )}

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      {captura && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={reaplicar}
            className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white"
          >
            Reaplicar captura no formulário
          </button>
        </div>
      )}
    </section>
  );
}
