"use client";

import { useCallback, useEffect, useState } from "react";

type Diagnostico = {
  configurada: boolean;
  apiRespondendo?: boolean;
  totalMarcas?: number;
  totalCanais?: number;
  diagnosticoErro?: string;
};

export default function AdminLomadeePage() {
  const [apiKey, setApiKey] = useState("");
  const [configurada, setConfigurada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);

  const testarIntegracao = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setErro("");
      setMensagem("");
    }
    setTestando(true);
    try {
      const resposta = await fetch("/api/admin/lomadee?diagnostico=1", {
        cache: "no-store",
      });
      const dados = (await resposta.json()) as Diagnostico & {
        erro?: string;
      };
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível testar a Lomadee.");
      }

      setConfigurada(Boolean(dados.configurada));
      setDiagnostico(dados);

      if (!silencioso) {
        setMensagem(
          dados.apiRespondendo
            ? "API Lomadee respondendo normalmente."
            : "Chave armazenada, mas a API não respondeu ao teste."
        );
      }
    } catch (e) {
      if (!silencioso) {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível testar a Lomadee."
        );
      }
    } finally {
      setTestando(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/lomadee", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const conectada = Boolean(d.configurada);
        setConfigurada(conectada);
        if (conectada) void testarIntegracao(true);
      })
      .catch(() => setErro("Não foi possível consultar o status da Lomadee."))
      .finally(() => setCarregando(false));
  }, [testarIntegracao]);

  async function conectar() {
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const resposta = await fetch("/api/admin/lomadee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const dados = await resposta.json();
      if (!resposta.ok)
        throw new Error(dados.erro || "Falha ao conectar a Lomadee.");

      setConfigurada(true);
      setApiKey("");
      setMensagem(
        `Lomadee conectada com sucesso${
          dados.totalMarcas
            ? ` · ${dados.totalMarcas} marca(s) acessível(is)`
            : ""
        }.`
      );
      await testarIntegracao(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conectar a Lomadee.");
    } finally {
      setSalvando(false);
    }
  }

  const apiOk = Boolean(diagnostico?.apiRespondendo);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-wider text-orange-500">
            Achados do Casal
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-black">Integração Lomadee</h1>
              <p className="mt-2 text-slate-600">
                Affiliate API para produtos, preços, campanhas, pedidos e
                deeplinks monetizados.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                configurada
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {carregando
                ? "Verificando..."
                : configurada
                  ? "Conectada"
                  : "Não conectada"}
            </span>
          </div>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-black">API Key</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cole a chave gerada em Credenciais API na Lomadee. Ela é testada
              antes de ser salva e fica armazenada de forma criptografada no
              Vault do Supabase.
            </p>

            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                configurada
                  ? "Cole uma nova chave apenas se quiser substituir a atual"
                  : "Cole aqui a API Key da Lomadee"
              }
              className="mt-4 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm outline-none focus:border-slate-500"
            />

            <button
              onClick={conectar}
              disabled={salvando || !apiKey.trim()}
              className="mt-3 rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando
                ? "Testando e salvando..."
                : configurada
                  ? "Substituir e testar chave"
                  : "Conectar e testar Lomadee"}
            </button>
          </div>

          {mensagem ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
              {mensagem}
            </div>
          ) : null}

          {erro ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
              {erro}
            </div>
          ) : null}
        </section>

        {configurada ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
                  Status da integração
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Lomadee pronta para operação
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  A chave permanece protegida no servidor. O diagnóstico abaixo
                  consulta a Affiliate API sem expor a credencial no navegador.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void testarIntegracao(false)}
                disabled={testando}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black hover:bg-slate-50 disabled:opacity-50"
              >
                {testando ? "Testando API..." : "Testar conexão agora"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  titulo: "API Key",
                  valor: "Armazenada",
                  detalhe: "Vault do Supabase",
                  ok: true,
                },
                {
                  titulo: "Affiliate API",
                  valor: testando
                    ? "Testando..."
                    : diagnostico
                      ? apiOk
                        ? "Respondendo"
                        : "Atenção"
                      : "Aguardando",
                  detalhe: "api.lomadee.com.br",
                  ok: apiOk,
                },
                {
                  titulo: "Marcas acessíveis",
                  valor:
                    diagnostico?.totalMarcas == null
                      ? "—"
                      : String(diagnostico.totalMarcas),
                  detalhe: "visíveis para esta chave",
                  ok: apiOk,
                },
                {
                  titulo: "Canais",
                  valor:
                    diagnostico?.totalCanais == null
                      ? "—"
                      : String(diagnostico.totalCanais),
                  detalhe: "disponíveis para links",
                  ok: apiOk,
                },
              ].map((item) => (
                <div
                  key={item.titulo}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {item.titulo}
                  </p>
                  <p
                    className={`mt-2 text-xl font-black ${
                      item.ok ? "text-emerald-700" : "text-slate-950"
                    }`}
                  >
                    {item.valor}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.detalhe}</p>
                </div>
              ))}
            </div>

            {diagnostico?.diagnosticoErro ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                A chave está salva, mas o teste da API falhou:{" "}
                {diagnostico.diagnosticoErro}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <p className="text-sm font-black uppercase tracking-wide text-orange-700">
                  Confirmado pela Lomadee
                </p>
                <h3 className="mt-2 text-lg font-black">
                  A API é o caminho oficial para automatizar o site
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>• Atualização automática de produtos, preços e ofertas.</li>
                  <li>• Geração de deeplinks monetizados.</li>
                  <li>• Consulta de pedidos, vendas e comissões.</li>
                  <li>• Token gerado em Credenciais API e sujeito à liberação da Lomadee.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <p className="text-sm font-black uppercase tracking-wide text-blue-700">
                  Próxima etapa
                </p>
                <h3 className="mt-2 text-lg font-black">
                  Homologação + automações
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Com a chave respondendo, podemos usar a mesma integração para
                  alimentar catálogos, atualizar ofertas e depois importar os
                  relatórios de vendas da Lomadee para os Resultados Comerciais.
                </p>

                <a
                  href="https://docs.lomadee.com.br/api-reference/introduction"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-xl bg-blue-950 px-4 py-3 text-sm font-black text-white hover:bg-blue-900"
                >
                  Abrir documentação oficial ↗
                </a>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
