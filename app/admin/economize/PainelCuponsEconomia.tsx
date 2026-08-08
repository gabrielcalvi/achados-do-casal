"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type LojaCupom = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
};

type CupomEconomize = {
  id: string;
  loja_id: string;

  status:
    | "pendente"
    | "ativo"
    | "expirado"
    | "inativo"
    | "erro";

  codigo: string | null;
  titulo: string;
  descricao: string | null;
  regras: string | null;

  tipo_desconto:
    | "percentual"
    | "valor_fixo"
    | "frete_gratis"
    | "outro";

  desconto_percentual: number | null;
  valor_desconto: number | null;
  pedido_minimo: number | null;
  limite_desconto: number | null;

  publico_alvo: string | null;
  elegibilidade: string | null;
  limite_por_usuario: number | null;

  somente_app: boolean;
  exige_mercado_pago: boolean;

  data_inicio: string | null;
  validade: string | null;

  link_destino: string | null;
  link_afiliado: string | null;

  origem: string;
  origem_url: string | null;
  dedupe_key: string | null;

  coletado_em: string | null;
  verificado_em: string | null;
  created_at: string;
  updated_at: string;

  loja: LojaCupom | LojaCupom[] | null;
  oferta_ids?: string[];
};

type RespostaCupons = {
  cupons?: CupomEconomize[];
  total?: number;
  error?: string;
  detalhes?: string;
};

type RespostaCadastro = {
  mensagem?: string;
  cupom?: CupomEconomize;
  error?: string;
  detalhes?: string;
};

type LojaDisponivel = {
  id: string;
  nome: string;
  slug: string;
};

type OfertaDisponivelCupom = {
  id: string;
  loja_id: string;
  titulo: string;
};

type RespostaOfertasPublicas = {
  ofertas?: OfertaDisponivelCupom[];
  error?: string;
};

type PainelCuponsEconomiaProps = {
  lojas: LojaDisponivel[];
};

type TipoDesconto =
  | "percentual"
  | "valor_fixo"
  | "frete_gratis"
  | "outro";

type FormularioCupom = {
  loja_id: string;
  oferta_id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  regras: string;
  tipo_desconto: TipoDesconto;
  desconto_percentual: string;
  valor_desconto: string;
  pedido_minimo: string;
  limite_desconto: string;
  publico_alvo: string;
  elegibilidade: string;
  limite_por_usuario: string;
  somente_app: boolean;
  exige_mercado_pago: boolean;
  data_inicio: string;
  validade: string;
  link_destino: string;
  link_afiliado: string;
};

const FORMULARIO_INICIAL: FormularioCupom = {
  loja_id: "",
  oferta_id: "",
  codigo: "",
  titulo: "",
  descricao: "",
  regras: "",
  tipo_desconto: "percentual",
  desconto_percentual: "",
  valor_desconto: "",
  pedido_minimo: "",
  limite_desconto: "",
  publico_alvo: "",
  elegibilidade: "",
  limite_por_usuario: "",
  somente_app: false,
  exige_mercado_pago: false,
  data_inicio: "",
  validade: "",
  link_destino: "",
  link_afiliado: "",
};

const ROTULOS_STATUS: Record<
  CupomEconomize["status"],
  string
> = {
  pendente: "Pendente",
  ativo: "Ativo",
  expirado: "Expirado",
  inativo: "Inativo",
  erro: "Erro",
};

const CORES_STATUS: Record<
  CupomEconomize["status"],
  string
> = {
  pendente:
    "bg-amber-100 text-amber-700",
  ativo:
    "bg-emerald-100 text-emerald-700",
  expirado:
    "bg-slate-200 text-slate-700",
  inativo:
    "bg-slate-200 text-slate-700",
  erro:
    "bg-red-100 text-red-700",
};

function normalizarLoja(
  loja: CupomEconomize["loja"]
): LojaCupom | null {
  if (Array.isArray(loja)) {
    return loja[0] ?? null;
  }

  return loja;
}

function formatarMoeda(
  valor: number | null
) {
  if (valor === null) {
    return null;
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  ).format(valor);
}

function formatarData(
  valor: string | null
) {
  if (!valor) {
    return "Não informada";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(data);
}

function descricaoDesconto(
  cupom: CupomEconomize
) {
  if (
    cupom.tipo_desconto ===
      "percentual" &&
    cupom.desconto_percentual !== null
  ) {
    return `${cupom.desconto_percentual}% OFF`;
  }

  if (
    cupom.tipo_desconto ===
      "valor_fixo" &&
    cupom.valor_desconto !== null
  ) {
    return `${formatarMoeda(
      cupom.valor_desconto
    )} OFF`;
  }

  if (
    cupom.tipo_desconto ===
    "frete_gratis"
  ) {
    return "Frete grátis";
  }

  return "Benefício especial";
}

function converterNumero(
  valor: string
) {
  const texto = valor.trim();

  if (!texto) {
    return null;
  }

  return Number(
    texto.replace(",", ".")
  );
}

export default function PainelCuponsEconomia({
  lojas,
}: PainelCuponsEconomiaProps) {
  const [
    cupons,
    setCupons,
  ] = useState<CupomEconomize[]>([]);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    salvando,
    setSalvando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  const [
    mostrarFormulario,
    setMostrarFormulario,
  ] = useState(false);
const [
  cupomEmEdicao,
  setCupomEmEdicao,
] = useState<CupomEconomize | null>(null);
  const [
    filtroStatus,
    setFiltroStatus,
  ] = useState("todos");

  const [
    filtroLoja,
    setFiltroLoja,
  ] = useState("todas");

  const [
    ofertasDisponiveis,
    setOfertasDisponiveis,
  ] = useState<OfertaDisponivelCupom[]>([]);

  const [
    carregandoOfertas,
    setCarregandoOfertas,
  ] = useState(false);

  const [
    formulario,
    setFormulario,
  ] = useState<FormularioCupom>({
    ...FORMULARIO_INICIAL,
    loja_id: lojas[0]?.id ?? "",
  });

  const carregarCupons =
    useCallback(async () => {
      try {
        setCarregando(true);
        setErro("");

        const parametros =
          new URLSearchParams();

        parametros.set(
          "limite",
          "200"
        );

        if (
          filtroStatus !== "todos"
        ) {
          parametros.set(
            "status",
            filtroStatus
          );
        }

        if (
          filtroLoja !== "todas"
        ) {
          parametros.set(
            "loja_id",
            filtroLoja
          );
        }

        const resposta = await fetch(
          `/api/admin/economize/cupons?${parametros.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          (await resposta.json()) as RespostaCupons;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ||
              resultado.detalhes ||
              "Não foi possível carregar os cupons."
          );
        }

        setCupons(
          resultado.cupons ?? []
        );
      } catch (error) {
        console.error(
          "Erro ao carregar cupons:",
          error
        );

        setErro(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar os cupons."
        );
      } finally {
        setCarregando(false);
      }
    }, [
      filtroLoja,
      filtroStatus,
    ]);

  useEffect(() => {
    carregarCupons();
  }, [carregarCupons]);

  useEffect(() => {
    if (
      formulario.loja_id ||
      lojas.length === 0
    ) {
      return;
    }

    setFormulario(
      (formularioAtual) => ({
        ...formularioAtual,
        loja_id:
          lojas[0]?.id ?? "",
      })
    );
  }, [
    formulario.loja_id,
    lojas,
  ]);

  useEffect(() => {
    const lojaSelecionada = lojas.find(
      (loja) =>
        loja.id === formulario.loja_id
    );

    if (!lojaSelecionada) {
      setOfertasDisponiveis([]);
      return;
    }

    const slugLojaSelecionada =
      lojaSelecionada.slug;

    let cancelado = false;

    async function carregarOfertas() {
      try {
        setCarregandoOfertas(true);

        const resposta = await fetch(
          `/api/economize/ofertas?loja=${encodeURIComponent(
            slugLojaSelecionada
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const resultado =
          (await resposta.json()) as RespostaOfertasPublicas;

        if (!resposta.ok) {
          throw new Error(
            resultado.error ||
              "Não foi possível carregar as ofertas da loja."
          );
        }

        if (!cancelado) {
          setOfertasDisponiveis(
            resultado.ofertas ?? []
          );
        }
      } catch (error) {
        console.error(
          "Erro ao carregar ofertas para o cupom:",
          error
        );

        if (!cancelado) {
          setOfertasDisponiveis([]);
        }
      } finally {
        if (!cancelado) {
          setCarregandoOfertas(false);
        }
      }
    }

    carregarOfertas();

    return () => {
      cancelado = true;
    };
  }, [
    formulario.loja_id,
    lojas,
  ]);

  const resumo = useMemo(() => {
    return {
      total: cupons.length,

      ativos: cupons.filter(
        (cupom) =>
          cupom.status === "ativo"
      ).length,

      pendentes: cupons.filter(
        (cupom) =>
          cupom.status === "pendente"
      ).length,

      expirados: cupons.filter(
        (cupom) =>
          cupom.status === "expirado"
      ).length,
    };
  }, [cupons]);

  function atualizarCampo<
    Campo extends keyof FormularioCupom
  >(
    campo: Campo,
    valor: FormularioCupom[Campo]
  ) {
    setFormulario(
      (formularioAtual) => ({
        ...formularioAtual,
        [campo]: valor,
      })
    );
  }
function abrirEdicaoCupom(
  cupom: CupomEconomize
) {
  setCupomEmEdicao(cupom);

  setFormulario({
    loja_id: cupom.loja_id,
    oferta_id:
      cupom.oferta_ids?.[0] ?? "",
    codigo: cupom.codigo ?? "",
    titulo: cupom.titulo,
    descricao: cupom.descricao ?? "",
    regras: cupom.regras ?? "",
    tipo_desconto: cupom.tipo_desconto,

    desconto_percentual:
      cupom.desconto_percentual !== null
        ? String(cupom.desconto_percentual)
        : "",

    valor_desconto:
      cupom.valor_desconto !== null
        ? String(cupom.valor_desconto)
        : "",

    pedido_minimo:
      cupom.pedido_minimo !== null
        ? String(cupom.pedido_minimo)
        : "",

    limite_desconto:
      cupom.limite_desconto !== null
        ? String(cupom.limite_desconto)
        : "",

    publico_alvo:
      cupom.publico_alvo ?? "",

    elegibilidade:
      cupom.elegibilidade ?? "",

    limite_por_usuario:
      cupom.limite_por_usuario !== null
        ? String(cupom.limite_por_usuario)
        : "",

    somente_app:
      cupom.somente_app,

    exige_mercado_pago:
      cupom.exige_mercado_pago,

    data_inicio:
      cupom.data_inicio
        ? cupom.data_inicio.slice(0, 16)
        : "",

    validade:
      cupom.validade
        ? cupom.validade.slice(0, 16)
        : "",

    link_destino:
      cupom.link_destino ?? "",

    link_afiliado:
      cupom.link_afiliado ?? "",
  });

  setMostrarFormulario(true);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}
  function limparFormulario() {
    setFormulario({
      ...FORMULARIO_INICIAL,
      loja_id:
        lojas[0]?.id ?? "",
    });
  }
async function alterarStatusCupom(
  cupom: CupomEconomize
) {
  const novoStatus =
    cupom.status === "ativo"
      ? "inativo"
      : "ativo";

  try {
    setErro("");
    setMensagem("");

    const resposta = await fetch(
      `/api/admin/economize/cupons/${cupom.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          status: novoStatus,
        }),
      }
    );

    const resultado =
      (await resposta.json()) as {
        mensagem?: string;
        error?: string;
        detalhes?: string;
      };

    if (!resposta.ok) {
      throw new Error(
        resultado.error ||
          resultado.detalhes ||
          "Não foi possível alterar o status do cupom."
      );
    }

    setMensagem(
      resultado.mensagem ||
        "Status do cupom alterado com sucesso."
    );

    await carregarCupons();
  } catch (error) {
    console.error(
      "Erro ao alterar status do cupom:",
      error
    );

    setErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao alterar o status."
    );
  }
}

async function excluirCupom(
  cupom: CupomEconomize
) {
  const confirmou = window.confirm(
    `Deseja realmente excluir o cupom "${cupom.titulo}"? Essa ação não poderá ser desfeita.`
  );

  if (!confirmou) {
    return;
  }

  try {
    setErro("");
    setMensagem("");

    const resposta = await fetch(
      `/api/admin/economize/cupons/${cupom.id}`,
      {
        method: "DELETE",
      }
    );

    const resultado =
      (await resposta.json()) as {
        mensagem?: string;
        error?: string;
        detalhes?: string;
      };

    if (!resposta.ok) {
      throw new Error(
        resultado.error ||
          resultado.detalhes ||
          "Não foi possível excluir o cupom."
      );
    }

    setMensagem(
      resultado.mensagem ||
        "Cupom excluído com sucesso."
    );

    await carregarCupons();
  } catch (error) {
    console.error(
      "Erro ao excluir cupom:",
      error
    );

    setErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao excluir o cupom."
    );
  }
}
  async function cadastrarCupom(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSalvando(true);
      setErro("");
      setMensagem("");

      const url = cupomEmEdicao
  ? `/api/admin/economize/cupons/${cupomEmEdicao.id}`
  : "/api/admin/economize/cupons";

const metodo = cupomEmEdicao
  ? "PATCH"
  : "POST";

const resposta = await fetch(
  url,
  {
    method: metodo,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            loja_id:
              formulario.loja_id,

            oferta_ids:
              formulario.oferta_id
                ? [
                    formulario.oferta_id,
                  ]
                : [],

            status: "pendente",

            codigo:
              formulario.codigo,

            titulo:
              formulario.titulo,

            descricao:
              formulario.descricao,

            regras:
              formulario.regras,

            tipo_desconto:
              formulario.tipo_desconto,

            desconto_percentual:
              converterNumero(
                formulario.desconto_percentual
              ),

            valor_desconto:
              converterNumero(
                formulario.valor_desconto
              ),

            pedido_minimo:
              converterNumero(
                formulario.pedido_minimo
              ),

            limite_desconto:
              converterNumero(
                formulario.limite_desconto
              ),

            publico_alvo:
              formulario.publico_alvo,

            elegibilidade:
              formulario.elegibilidade,

            limite_por_usuario:
              converterNumero(
                formulario.limite_por_usuario
              ),

            somente_app:
              formulario.somente_app,

            exige_mercado_pago:
              formulario.exige_mercado_pago,

            data_inicio:
              formulario.data_inicio,

            validade:
              formulario.validade,

            link_destino:
              formulario.link_destino,

            link_afiliado:
              formulario.link_afiliado,

            origem: "manual",
          }),
        }
      );

      const resultado =
        (await resposta.json()) as RespostaCadastro;

      if (!resposta.ok) {
        throw new Error(
          resultado.error ||
            resultado.detalhes ||
            "Não foi possível cadastrar o cupom."
        );
      }

      setMensagem(
        resultado.mensagem ||
          "Cupom cadastrado com sucesso."
      );

      limparFormulario();
setCupomEmEdicao(null);
      setMostrarFormulario(false);

      await carregarCupons();
    } catch (error) {
      console.error(
        "Erro ao cadastrar cupom:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar o cupom."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
            Cupons da Central
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Cupons e benefícios
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Cadastre, revise e acompanhe
            cupons encontrados manualmente
            ou pelo Agente de Economia.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              carregarCupons()
            }
            disabled={carregando}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando
              ? "Atualizando..."
              : "Atualizar cupons"}
          </button>

          <button
            type="button"
            onClick={() =>
              setMostrarFormulario(
                (valorAtual) =>
                  !valorAtual
              )
            }
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
          >
            {mostrarFormulario
              ? "Fechar cadastro"
              : "+ Novo cupom"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-5">
          <p className="text-sm font-bold text-slate-500">
            Cupons encontrados
          </p>

          <p className="mt-3 text-3xl font-black text-slate-950">
            {resumo.total}
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-700">
            Ativos
          </p>

          <p className="mt-3 text-3xl font-black text-emerald-700">
            {resumo.ativos}
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-700">
            Pendentes
          </p>

          <p className="mt-3 text-3xl font-black text-amber-700">
            {resumo.pendentes}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-100 p-5">
          <p className="text-sm font-bold text-slate-600">
            Expirados
          </p>

          <p className="mt-3 text-3xl font-black text-slate-700">
            {resumo.expirados}
          </p>
        </div>
      </div>

      {mensagem && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
          {mensagem}
        </div>
      )}

      {erro && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </div>
      )}

      {mostrarFormulario && (
        <form
          onSubmit={cadastrarCupom}
          className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"
        >
          <div>
            <h3 className="text-xl font-black text-slate-950">
             {cupomEmEdicao
  ? "Editar cupom"
  : "Cadastrar novo cupom"}
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              O cupom será cadastrado
              como pendente para revisão.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Loja *
              </span>

              <select
                required
                value={
                  formulario.loja_id
                }
                onChange={(event) =>
                  setFormulario(
                    (formularioAtual) => ({
                      ...formularioAtual,
                      loja_id:
                        event.target.value,
                      oferta_id: "",
                    })
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              >
                <option value="">
                  Selecione uma loja
                </option>

                {lojas.map((loja) => (
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
                <span className="text-sm font-bold text-slate-700">
                  Oferta vinculada
                </span>

                <select
                  value={
                    formulario.oferta_id
                  }
                  onChange={(event) =>
                    atualizarCampo(
                      "oferta_id",
                      event.target.value
                    )
                  }
                  disabled={
                    !formulario.loja_id ||
                    carregandoOfertas
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {carregandoOfertas
                      ? "Carregando ofertas..."
                      : "Sem vínculo"}
                  </option>

                  {ofertasDisponiveis.map(
                    (oferta) => (
                      <option
                        key={oferta.id}
                        value={oferta.id}
                      >
                        {oferta.titulo}
                      </option>
                    )
                  )}
                </select>

                <span className="text-xs text-slate-500">
                  Mostra somente ofertas ativas da loja selecionada.
                </span>
              </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Código do cupom
              </span>

              <input
                value={
                  formulario.codigo
                }
                onChange={(event) =>
                  atualizarCampo(
                    "codigo",
                    event.target.value
                  )
                }
                placeholder="Ex.: ECONOMIZE10"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-bold text-slate-700">
                Título *
              </span>

              <input
                required
                value={
                  formulario.titulo
                }
                onChange={(event) =>
                  atualizarCampo(
                    "titulo",
                    event.target.value
                  )
                }
                placeholder="Ex.: 10% OFF em produtos selecionados"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Tipo do desconto *
              </span>

              <select
                required
                value={
                  formulario.tipo_desconto
                }
                onChange={(event) =>
                  atualizarCampo(
                    "tipo_desconto",
                    event.target
                      .value as TipoDesconto
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              >
                <option value="percentual">
                  Percentual
                </option>

                <option value="valor_fixo">
                  Valor fixo
                </option>

                <option value="frete_gratis">
                  Frete grátis
                </option>

                <option value="outro">
                  Outro benefício
                </option>
              </select>
            </label>

            {formulario.tipo_desconto ===
              "percentual" && (
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Desconto percentual *
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formulario.desconto_percentual
                  }
                  onChange={(event) =>
                    atualizarCampo(
                      "desconto_percentual",
                      event.target.value
                    )
                  }
                  placeholder="10"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                />
              </label>
            )}

            {formulario.tipo_desconto ===
              "valor_fixo" && (
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Valor do desconto *
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    formulario.valor_desconto
                  }
                  onChange={(event) =>
                    atualizarCampo(
                      "valor_desconto",
                      event.target.value
                    )
                  }
                  placeholder="50,00"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
                />
              </label>
            )}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Pedido mínimo
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formulario.pedido_minimo
                }
                onChange={(event) =>
                  atualizarCampo(
                    "pedido_minimo",
                    event.target.value
                  )
                }
                placeholder="100,00"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Limite do desconto
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  formulario.limite_desconto
                }
                onChange={(event) =>
                  atualizarCampo(
                    "limite_desconto",
                    event.target.value
                  )
                }
                placeholder="50,00"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Data de início
              </span>

              <input
                type="datetime-local"
                value={
                  formulario.data_inicio
                }
                onChange={(event) =>
                  atualizarCampo(
                    "data_inicio",
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Validade
              </span>

              <input
                type="datetime-local"
                value={
                  formulario.validade
                }
                onChange={(event) =>
                  atualizarCampo(
                    "validade",
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-bold text-slate-700">
                Regras
              </span>

              <textarea
                rows={3}
                value={
                  formulario.regras
                }
                onChange={(event) =>
                  atualizarCampo(
                    "regras",
                    event.target.value
                  )
                }
                placeholder="Explique pedido mínimo, categorias, limite e restrições."
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Público-alvo
              </span>

              <input
                value={
                  formulario.publico_alvo
                }
                onChange={(event) =>
                  atualizarCampo(
                    "publico_alvo",
                    event.target.value
                  )
                }
                placeholder="Ex.: Todos os usuários"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Elegibilidade
              </span>

              <input
                value={
                  formulario.elegibilidade
                }
                onChange={(event) =>
                  atualizarCampo(
                    "elegibilidade",
                    event.target.value
                  )
                }
                placeholder="Ex.: Contas elegíveis"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Limite por usuário
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  formulario.limite_por_usuario
                }
                onChange={(event) =>
                  atualizarCampo(
                    "limite_por_usuario",
                    event.target.value
                  )
                }
                placeholder="1"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">
                Link de destino
              </span>

              <input
                type="url"
                value={
                  formulario.link_destino
                }
                onChange={(event) =>
                  atualizarCampo(
                    "link_destino",
                    event.target.value
                  )
                }
                placeholder="https://..."
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>

            <label className="grid gap-2 lg:col-span-2">
              <span className="text-sm font-bold text-slate-700">
                Link de afiliado
              </span>

              <input
                type="url"
                value={
                  formulario.link_afiliado
                }
                onChange={(event) =>
                  atualizarCampo(
                    "link_afiliado",
                    event.target.value
                  )
                }
                placeholder="https://..."
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={
                  formulario.somente_app
                }
                onChange={(event) =>
                  atualizarCampo(
                    "somente_app",
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <span className="font-bold text-slate-700">
                Cupom exclusivo do app
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={
                  formulario.exige_mercado_pago
                }
                onChange={(event) =>
                  atualizarCampo(
                    "exige_mercado_pago",
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <span className="font-bold text-slate-700">
                Exige Mercado Pago
              </span>
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={
                salvando ||
                lojas.length === 0
              }
              className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando
  ? cupomEmEdicao
    ? "Salvando..."
    : "Cadastrando..."
  : cupomEmEdicao
    ? "Salvar alterações"
    : "Cadastrar cupom"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-950">
            Cupons cadastrados
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {cupons.length} cupom(ns)
            encontrado(s) com os filtros
            selecionados.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-600">
              Loja
            </span>

            <select
              value={filtroLoja}
              onChange={(event) =>
                setFiltroLoja(
                  event.target.value
                )
              }
              className="min-w-52 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            >
              <option value="todas">
                Todas as lojas
              </option>

              {lojas.map((loja) => (
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
              Status
            </span>

            <select
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value
                )
              }
              className="min-w-52 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600"
            >
              <option value="todos">
                Todos os status
              </option>

              <option value="pendente">
                Pendentes
              </option>

              <option value="ativo">
                Ativos
              </option>

              <option value="expirado">
                Expirados
              </option>

              <option value="inativo">
                Inativos
              </option>

              <option value="erro">
                Com erro
              </option>
            </select>
          </label>
        </div>
      </div>

      {carregando ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center font-bold text-slate-500">
          Carregando cupons...
        </div>
      ) : cupons.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-4xl">
            🎟️
          </p>

          <p className="mt-3 font-black text-slate-800">
            Nenhum cupom encontrado
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Cadastre o primeiro cupom
            ou aguarde a coleta do agente.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {cupons.map((cupom) => {
            const loja =
              normalizarLoja(
                cupom.loja
              );

            return (
              <article
                key={cupom.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-600">
                      🎟️ Cupom
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {loja?.nome ??
                        "Loja não identificada"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${CORES_STATUS[cupom.status]}`}
                  >
                    {
                      ROTULOS_STATUS[
                        cupom.status
                      ]
                    }
                  </span>
                </div>

                <h4 className="mt-4 text-xl font-black text-slate-950">
                  {cupom.titulo}
                </h4>

                {cupom.codigo && (
                  <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Código do cupom
                    </p>

                    <p className="mt-1 text-2xl font-black text-emerald-900">
                      {cupom.codigo}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Benefício
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      {descricaoDesconto(
                        cupom
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Pedido mínimo
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      {formatarMoeda(
                        cupom.pedido_minimo
                      ) ??
                        "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Limite do desconto
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      {formatarMoeda(
                        cupom.limite_desconto
                      ) ??
                        "Não informado"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">
                      Validade
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      {formatarData(
                        cupom.validade
                      )}
                    </p>
                  </div>
                </div>

                {(cupom.somente_app ||
                  cupom.exige_mercado_pago) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cupom.somente_app && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                        📱 Somente no app
                      </span>
                    )}

                    {cupom.exige_mercado_pago && (
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">
                        💳 Exige Mercado Pago
                      </span>
                    )}
                  </div>
                )}

                {cupom.regras && (
                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Regras
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {cupom.regras}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                   <button
  type="button"
  onClick={() =>
    abrirEdicaoCupom(cupom)
  }
  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
>
  Editar
</button>
                   <button
                     type="button"
  onClick={() =>
    alterarStatusCupom(cupom)
  }
  className={`rounded-xl px-4 py-2 text-sm font-black text-white transition ${
    cupom.status === "ativo"
      ? "bg-amber-500 hover:bg-amber-600"
      : "bg-emerald-600 hover:bg-emerald-700"
  }`}
>
  {cupom.status === "ativo"
    ? "Desativar"
    : "Ativar"}
</button>

<button
  type="button"
  onClick={() =>
    excluirCupom(cupom)
  }
  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700"
>
  Excluir
</button>
                  {cupom.link_destino && (
                    
                    <a
                      href={
                        cupom.link_destino
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Abrir destino
                    </a>
                  )}

                  <span
                    className={`rounded-xl px-4 py-2 text-sm font-black ${
                      cupom.link_afiliado?.trim()
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {cupom.link_afiliado?.trim()
                      ? "✓ Afiliado configurado"
                      : "⚠ Afiliado pendente"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}