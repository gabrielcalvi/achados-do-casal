"use client";

import { useEffect, useState } from "react";

type ConfigStatus = {
  configurado: boolean;
  faltantes: string[];
  marketplace: string;
  credentialVersion: string | null;
  partnerTagConfigurado: boolean;
};

type StatusResponse = {
  sucesso?: boolean;
  erro?: string;
  config?: ConfigStatus;
  pronto_para_teste?: boolean;
};

type TestResponse = {
  sucesso?: boolean;
  erro?: string;
  autenticado?: boolean;
  asin?: string;
  marketplace?: string;
  item?: any;
  erros?: any[];
};

function precoItem(item: any) {
  const listings = item?.offersV2?.listings;
  if (!Array.isArray(listings)) return null;
  const buyBox = listings.find((x: any) => x?.isBuyBoxWinner) || listings[0];
  return buyBox?.price?.money?.displayAmount || null;
}

function imagemItem(item: any) {
  return (
    item?.images?.primary?.large?.url ||
    item?.images?.primary?.medium?.url ||
    item?.images?.primary?.small?.url ||
    null
  );
}

export default function PainelAmazonCreators() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState("");
  const [asin, setAsin] = useState("B0GBOQNOF");
  const [resultado, setResultado] = useState<any>(null);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const resposta = await fetch("/api/admin/economize/amazon/creators", {
        cache: "no-store",
      });
      const dados = (await resposta.json()) as StatusResponse;
      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao carregar status Amazon.");
      }
      setStatus(dados.config ?? null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar Amazon.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function testar() {
    try {
      setTestando(true);
      setErro("");
      setResultado(null);

      const resposta = await fetch("/api/admin/economize/amazon/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin }),
      });
      const dados = (await resposta.json()) as TestResponse;
      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao testar Creators API.");
      }
      setResultado(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao testar Creators API.");
    } finally {
      setTestando(false);
    }
  }

  const item = resultado?.item;
  const titulo = item?.itemInfo?.title?.displayValue || null;
  const preco = precoItem(item);
  const imagem = imagemItem(item);

  return (
    <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-amber-600">
            Amazon Associados
          </p>
          <h2 className="mt-2 text-2xl font-black">Creators API oficial</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Base oficial para recuperar produtos, imagens, preço e disponibilidade da Amazon Brasil.
            O scraping permanece pausado até este painel confirmar autenticação e GetItems.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          🔄 Atualizar status
        </button>
      </div>

      {erro && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
          Carregando configuração Amazon...
        </div>
      ) : status ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${
              status.configurado
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              <p className="text-xs font-black uppercase">Credenciais</p>
              <p className="mt-2 text-xl font-black">
                {status.configurado ? "✅ Configuradas" : "⚠️ Pendentes"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <p className="text-xs font-black uppercase">Marketplace</p>
              <p className="mt-2 text-xl font-black">{status.marketplace}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <p className="text-xs font-black uppercase">Partner Tag</p>
              <p className="mt-2 text-xl font-black">
                {status.partnerTagConfigurado ? "✅ Configurado" : "⚠️ Pendente"}
              </p>
            </div>
          </div>

          {!status.configurado && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-900">Faltam variáveis seguras na Vercel:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {status.faltantes.map((item) => (
                  <code
                    key={item}
                    className="rounded-lg bg-white px-2 py-1 text-xs font-black text-amber-900"
                  >
                    {item}
                  </code>
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-800">
                Não cole Credential Secret em chat ou GitHub. Configure diretamente em Environment Variables do projeto na Vercel.
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="text-sm font-black text-slate-700">ASIN para teste oficial</span>
                <input
                  value={asin}
                  onChange={(event) => setAsin(event.target.value.toUpperCase())}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold outline-none focus:border-amber-500"
                  placeholder="B0..."
                />
              </label>
              <button
                type="button"
                onClick={testar}
                disabled={!status.configurado || testando || !asin.trim()}
                className="rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testando ? "Testando..." : "🧪 Testar GetItems"}
              </button>
            </div>

            {resultado?.sucesso && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="font-black text-emerald-700">
                  ✅ OAuth + GetItems funcionando
                </p>
                {item ? (
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                    {imagem && (
                      <img
                        src={imagem}
                        alt={titulo || resultado.asin || "Produto Amazon"}
                        className="h-32 w-32 rounded-xl border border-slate-200 bg-white object-contain p-2"
                      />
                    )}
                    <div>
                      <p className="font-black text-slate-950">{titulo || resultado.asin}</p>
                      <p className="mt-2 text-2xl font-black text-emerald-700">
                        {preco || "Preço não retornado para este ASIN"}
                      </p>
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        Marketplace: {resultado.marketplace}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Autenticação funcionou, mas este ASIN não retornou item.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
