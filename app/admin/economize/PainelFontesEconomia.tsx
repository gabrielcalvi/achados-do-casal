"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type LojaFonte = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

type TipoFonte =
  | "pagina"
  | "api"
  | "feed"
  | "afiliado"
  | "manual";

type FonteEconomia = {
  id: string;
  loja_id: string;
  nome: string;
  tipo: TipoFonte;
  url: string | null;
  ativa: boolean;
  prioridade: number;
  intervalo_minutos: number;
  ultima_execucao_em: string | null;
  proxima_execucao_em: string | null;
  configuracao: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  loja: {
    id: string;
    nome: string;
    slug: string;
    ativa: boolean;
    ordem: number;
  } | null;
};

type RespostaFontes = {
  fontes?: FonteEconomia[];
  total?: number;
  error?: string;
};

type RespostaCadastro = {
  mensagem?: string;
  fonte?: FonteEconomia;
  error?: string;
};

type PainelFontesEconomiaProps = {
  lojas: LojaFonte[];
};

type FormularioFonte = {
  lojaId: string;
  nome: string;
  tipo: TipoFonte;
  url: string;
  ativa: boolean;
  prioridade: string;
  intervaloMinutos: string;
};

const formularioInicial: FormularioFonte = {
  lojaId: "",
  nome: "",
  tipo: "pagina",
  url: "",
  ativa: true,
  prioridade: "100",
  intervaloMinutos: "360",
};

const tiposFonte: Array<{
  valor: TipoFonte;
  rotulo: string;
  descricao: string;
}> = [
  {
    valor: "pagina",
    rotulo: "Página",
    descricao:
      "Página pública de cupons, promoções ou campanhas.",
  },
  {
    valor: "api",
    rotulo: "API",
    descricao:
      "Endpoint estruturado fornecido pela loja ou parceiro.",
  },
  {
    valor: "feed",
    rotulo: "Feed",
    descricao:
      "Arquivo ou catálogo atualizado periodicamente.",
  },
  {
    valor: "afiliado",
    rotulo: "Plataforma de afiliados",
    descricao:
      "Campanhas e oportunidades disponíveis no programa de afiliados.",
  },
  {
    valor: "manual",
    rotulo: "Fonte manual",
    descricao:
      "Fonte acompanhada manualmente, sem coleta automática por URL.",
  },
];

const rotulosTipo: Record<TipoFonte, string> = {
  pagina: "Página",
  api: "API",
  feed: "Feed",
  afiliado: "Afiliados",
  manual: "Manual",
};

const iconesTipo: Record<TipoFonte, string> = {
  pagina: "🌐",
  api: "🔌",
  feed: "📡",
  afiliado: "🤝",
  manual: "✍️",
};

function formatarDataHora(valor: string | null) {
  if (!valor) {
    return "Ainda não executada";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Data inválida";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarIntervalo(minutos: number) {
  if (minutos < 60) {
    return `${minutos} min`;
  }

  if (minutos % 1440 === 0) {
    const dias = minutos / 1440;

    return dias === 1
      ? "1 dia"
      : `${dias} dias`;
  }

  if (minutos % 60 === 0) {
    const horas = minutos / 60;

    return horas === 1
      ? "1 hora"
      : `${horas} horas`;
  }

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;

  return `${horas}h ${minutosRestantes}min`;
}

export default function PainelFontesEconomia({
  lojas,
}: PainelFontesEconomiaProps) {
  const [fontes, setFontes] = useState<
    FonteEconomia[]
  >([]);

  const [formulario, setFormulario] =
    useState<FormularioFonte>(
      formularioInicial
    );

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [erro, setErro] = useState("");

  const [mensagem, setMensagem] =
    useState("");

  const lojasAtivas = useMemo(
    () =>
      lojas
        .filter((loja) => loja.ativa)
        .sort((a, b) => a.ordem - b.ordem),
    [lojas]
  );

  const carregarFontes =
    useCallback(async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(
          "/api/admin/economize/agente/fontes",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          (await resposta.json()) as RespostaFontes;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ||
              "Não foi possível carregar as fontes."
          );
        }

        setFontes(resultado.fontes ?? []);
      } catch (error) {
        console.error(
          "Erro ao carregar fontes do agente:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar as fontes."
        );
      } finally {
        setCarregando(false);
      }
    }, []);

  useEffect(() => {
    carregarFontes();
  }, [carregarFontes]);

  useEffect(() => {
    if (
      !formulario.lojaId &&
      lojasAtivas.length > 0
    ) {
      setFormulario((valorAtual) => ({
        ...valorAtual,
        lojaId: lojasAtivas[0].id,
      }));
    }
  }, [
    formulario.lojaId,
    lojasAtivas,
  ]);

  function atualizarCampo<
    Chave extends keyof FormularioFonte
  >(
    chave: Chave,
    valor: FormularioFonte[Chave]
  ) {
    setFormulario((valorAtual) => ({
      ...valorAtual,
      [chave]: valor,
    }));
  }

  async function cadastrarFonte(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSalvando(true);
      setErro("");
      setMensagem("");

      const prioridade = Number(
        formulario.prioridade
      );

      const intervaloMinutos = Number(
        formulario.intervaloMinutos
      );

      const resposta = await fetch(
        "/api/admin/economize/agente/fontes",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            lojaId: formulario.lojaId,
            nome: formulario.nome.trim(),
            tipo: formulario.tipo,
            url: formulario.url.trim(),
            ativa: formulario.ativa,
            prioridade,
            intervaloMinutos,
            configuracao: {},
          }),
        }
      );

      const resultado =
        (await resposta.json()) as RespostaCadastro;

      if (!resposta.ok) {
        throw new Error(
          resultado.error ||
            "Não foi possível cadastrar a fonte."
        );
      }

      setMensagem(
        resultado.mensagem ||
          "Fonte cadastrada com sucesso."
      );

      setFormulario((valorAtual) => ({
        ...formularioInicial,
        lojaId:
          valorAtual.lojaId ||
          lojasAtivas[0]?.id ||
          "",
      }));

      await carregarFontes();
    } catch (error) {
      console.error(
        "Erro ao cadastrar fonte:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar a fonte."
      );
    } finally {
      setSalvando(false);
    }
  }

  const fontesAtivas = fontes.filter(
    (fonte) => fonte.ativa
  ).length;

  const lojasComFontes = new Set(
    fontes.map((fonte) => fonte.loja_id)
  ).size;

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
            Fontes do agente
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Onde procurar oportunidades
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Cadastre páginas oficiais, APIs,
            feeds, plataformas de afiliados ou
            fontes acompanhadas manualmente.
          </p>
        </div>

        <button
          type="button"
          onClick={carregarFontes}
          disabled={carregando}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {carregando
            ? "Atualizando..."
            : "Atualizar fontes"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Fontes cadastradas
          </p>

          <p className="mt-2 text-3xl font-black">
            {fontes.length}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Fontes ativas
          </p>

          <p className="mt-2 text-3xl font-black text-emerald-700">
            {fontesAtivas}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">
            Lojas monitoradas
          </p>

          <p className="mt-2 text-3xl font-black text-blue-700">
            {lojasComFontes}
          </p>
        </div>
      </div>

      {mensagem && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}

      <form
        onSubmit={cadastrarFonte}
        className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      >
        <div>
          <h3 className="text-lg font-black">
            Cadastrar nova fonte
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Começaremos pelas fontes oficiais e
            mais confiáveis de cada loja.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Loja *
            </span>

            <select
              value={formulario.lojaId}
              onChange={(event) =>
                atualizarCampo(
                  "lojaId",
                  event.target.value
                )
              }
              required
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            >
              <option value="">
                Selecione uma loja
              </option>

              {lojasAtivas.map((loja) => (
                <option
                  key={loja.id}
                  value={loja.id}
                >
                  {loja.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Nome da fonte *
            </span>

            <input
              type="text"
              value={formulario.nome}
              onChange={(event) =>
                atualizarCampo(
                  "nome",
                  event.target.value
                )
              }
              minLength={3}
              maxLength={150}
              required
              placeholder="Ex.: Página oficial de cupons"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Tipo da fonte *
            </span>

            <select
              value={formulario.tipo}
              onChange={(event) =>
                atualizarCampo(
                  "tipo",
                  event.target.value as TipoFonte
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            >
              {tiposFonte.map((tipo) => (
                <option
                  key={tipo.valor}
                  value={tipo.valor}
                >
                  {tipo.rotulo}
                </option>
              ))}
            </select>

            <span className="text-xs leading-5 text-slate-500">
              {
                tiposFonte.find(
                  (tipo) =>
                    tipo.valor ===
                    formulario.tipo
                )?.descricao
              }
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              URL{" "}
              {formulario.tipo !== "manual"
                ? "*"
                : "(opcional)"}
            </span>

            <input
              type="url"
              value={formulario.url}
              onChange={(event) =>
                atualizarCampo(
                  "url",
                  event.target.value
                )
              }
              required={
                formulario.tipo !== "manual"
              }
              placeholder="https://..."
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Prioridade *
            </span>

            <input
              type="number"
              value={formulario.prioridade}
              onChange={(event) =>
                atualizarCampo(
                  "prioridade",
                  event.target.value
                )
              }
              min={1}
              step={1}
              required
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            />

            <span className="text-xs text-slate-500">
              Números menores são consultados
              primeiro.
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Intervalo em minutos *
            </span>

            <input
              type="number"
              value={
                formulario.intervaloMinutos
              }
              onChange={(event) =>
                atualizarCampo(
                  "intervaloMinutos",
                  event.target.value
                )
              }
              min={15}
              step={1}
              required
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            />

            <span className="text-xs text-slate-500">
              360 minutos equivalem a 6 horas.
            </span>
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            type="checkbox"
            checked={formulario.ativa}
            onChange={(event) =>
              atualizarCampo(
                "ativa",
                event.target.checked
              )
            }
            className="h-5 w-5"
          />

          <span>
            <strong className="block text-sm">
              Fonte ativa
            </strong>

            <span className="text-xs text-slate-500">
              A fonte poderá ser considerada nas
              futuras execuções do agente.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={
              salvando ||
              lojasAtivas.length === 0
            }
            className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando
              ? "Cadastrando..."
              : "Cadastrar fonte"}
          </button>
        </div>
      </form>

      <div className="mt-7">
        <h3 className="text-lg font-black">
          Fontes cadastradas
        </h3>

        {carregando ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            Carregando fontes...
          </div>
        ) : fontes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <div className="text-4xl">
              🔎
            </div>

            <p className="mt-3 font-black">
              Nenhuma fonte cadastrada
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Cadastre a primeira fonte para
              começar a estruturar a coleta real.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {fontes.map((fonte) => (
              <article
                key={fonte.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xl">
                        {iconesTipo[fonte.tipo]}
                      </span>

                      <h4 className="font-black">
                        {fonte.nome}
                      </h4>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          fonte.ativa
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {fonte.ativa
                          ? "Ativa"
                          : "Inativa"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-bold text-slate-600">
                      {fonte.loja?.nome ||
                        "Loja não identificada"}
                      {" • "}
                      {rotulosTipo[fonte.tipo]}
                    </p>

                    {fonte.url && (
                      <a
                        href={fonte.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block max-w-3xl truncate text-sm font-bold text-blue-700 hover:underline"
                      >
                        {fonte.url}
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Prioridade
                      </p>

                      <p className="mt-1 font-black">
                        {fonte.prioridade}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Intervalo
                      </p>

                      <p className="mt-1 font-black">
                        {formatarIntervalo(
                          fonte.intervalo_minutos
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Última execução
                      </p>

                      <p className="mt-1 font-black">
                        {formatarDataHora(
                          fonte.ultima_execucao_em
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Próxima execução
                      </p>

                      <p className="mt-1 font-black">
                        {fonte.proxima_execucao_em
                          ? formatarDataHora(
                              fonte.proxima_execucao_em
                            )
                          : "Não agendada"}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}