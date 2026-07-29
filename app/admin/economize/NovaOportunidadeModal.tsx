"use client";

import { FormEvent, useState } from "react";

type LojaEconomize = {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  logo_url: string | null;
  ativa: boolean;
  ordem: number;
};

type NovaOportunidadeModalProps = {
  aberto: boolean;
  lojas: LojaEconomize[];
  aoFechar: () => void;
  aoCadastrar: () => void;
};

const estadoInicial = {
  lojaId: "",
  tipo: "cupom",
  status: "ativo",
  titulo: "",
  descricao: "",
  codigo: "",
  categoria: "",
  regras: "",
  linkDestino: "",
  linkAfiliado: "",
  imagemUrl: "",
  origemUrl: "",
  descontoPercentual: "",
  valorDesconto: "",
  cashbackPercentual: "",
  pedidoMinimo: "",
  precoOriginal: "",
  precoOferta: "",
  dataInicio: "",
  validade: "",
  destaque: false,
  selos: "",
};

export default function NovaOportunidadeModal({
  aberto,
  lojas,
  aoFechar,
  aoCadastrar,
}: NovaOportunidadeModalProps) {
  const [formulario, setFormulario] =
    useState(estadoInicial);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  if (!aberto) {
    return null;
  }

  function atualizarCampo(
    campo: keyof typeof estadoInicial,
    valor: string | boolean
  ) {
    setFormulario((estadoAtual) => ({
      ...estadoAtual,
      [campo]: valor,
    }));
  }

  function fecharModal() {
    if (salvando) {
      return;
    }

    setErro("");
    setSucesso("");
    aoFechar();
  }

  async function cadastrarOportunidade(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSalvando(true);
      setErro("");
      setSucesso("");

      const resposta = await fetch(
        "/api/admin/economize/ofertas",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formulario,
            selos: formulario.selos
              .split(",")
              .map((selo) => selo.trim())
              .filter(Boolean),
          }),
        }
      );

      const resultado = (await resposta.json()) as {
        mensagem?: string;
        error?: string;
      };

      if (!resposta.ok) {
        throw new Error(
          resultado.error ||
            "Não foi possível cadastrar a oportunidade."
        );
      }

      setSucesso(
        resultado.mensagem ||
          "Oportunidade cadastrada com sucesso."
      );

      setFormulario(estadoInicial);
      aoCadastrar();
    } catch (error) {
      console.error(
        "Erro ao cadastrar oportunidade:",
        error
      );

      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
              Central Economize
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Nova oportunidade
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre um cupom, cashback, promoção,
              campanha ou benefício de frete.
            </p>
          </div>

          <button
            type="button"
            onClick={fecharModal}
            disabled={salvando}
            className="rounded-xl border border-slate-300 px-4 py-2 font-black text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </header>

        <form
          onSubmit={cadastrarOportunidade}
          className="space-y-8 p-6"
        >
          {erro && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
              {sucesso}
            </div>
          )}

          <section>
            <h3 className="text-lg font-black text-slate-950">
              Informações principais
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Loja *
                </span>

                <select
                  required
                  value={formulario.lojaId}
                  onChange={(event) =>
                    atualizarCampo(
                      "lojaId",
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3"
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
                  Tipo *
                </span>

                <select
                  value={formulario.tipo}
                  onChange={(event) =>
                    atualizarCampo(
                      "tipo",
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="cupom">Cupom</option>
                  <option value="cashback">
                    Cashback
                  </option>
                  <option value="promocao">
                    Promoção
                  </option>
                  <option value="campanha">
                    Campanha
                  </option>
                  <option value="frete_gratis">
                    Frete grátis
                  </option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Status *
                </span>

                <select
                  value={formulario.status}
                  onChange={(event) =>
                    atualizarCampo(
                      "status",
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="ativo">Ativo</option>
                  <option value="pendente">
                    Pendente
                  </option>
                  <option value="inativo">
                    Inativo
                  </option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Título *
                </span>

                <input
                  required
                  maxLength={180}
                  value={formulario.titulo}
                  onChange={(event) =>
                    atualizarCampo(
                      "titulo",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: 15% OFF em produtos Logitech"
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Descrição
                </span>

                <textarea
                  rows={3}
                  value={formulario.descricao}
                  onChange={(event) =>
                    atualizarCampo(
                      "descricao",
                      event.target.value
                    )
                  }
                  placeholder="Explique de forma clara como funciona a oportunidade."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Código do cupom
                </span>

                <input
                  value={formulario.codigo}
                  onChange={(event) =>
                    atualizarCampo(
                      "codigo",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: LOGI15"
                  className="rounded-xl border border-slate-300 px-4 py-3 uppercase"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Categoria
                </span>

                <input
                  value={formulario.categoria}
                  onChange={(event) =>
                    atualizarCampo(
                      "categoria",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Informática"
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Regras e condições
                </span>

                <textarea
                  rows={3}
                  value={formulario.regras}
                  onChange={(event) =>
                    atualizarCampo(
                      "regras",
                      event.target.value
                    )
                  }
                  placeholder="Ex.: desconto limitado a R$ 100 por CPF."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">
              Links
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Link de destino *
                </span>

                <input
                  required
                  type="url"
                  value={formulario.linkDestino}
                  onChange={(event) =>
                    atualizarCampo(
                      "linkDestino",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Link de afiliado
                </span>

                <input
                  type="url"
                  value={formulario.linkAfiliado}
                  onChange={(event) =>
                    atualizarCampo(
                      "linkAfiliado",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Imagem
                </span>

                <input
                  type="url"
                  value={formulario.imagemUrl}
                  onChange={(event) =>
                    atualizarCampo(
                      "imagemUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Página onde a oportunidade foi encontrada
                </span>

                <input
                  type="url"
                  value={formulario.origemUrl}
                  onChange={(event) =>
                    atualizarCampo(
                      "origemUrl",
                      event.target.value
                    )
                  }
                  placeholder="https://..."
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">
              Valores e benefícios
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CampoNumerico
                titulo="Desconto percentual"
                valor={formulario.descontoPercentual}
                placeholder="Ex.: 15"
                aoAlterar={(valor) =>
                  atualizarCampo(
                    "descontoPercentual",
                    valor
                  )
                }
              />

              <CampoNumerico
                titulo="Desconto em reais"
                valor={formulario.valorDesconto}
                placeholder="Ex.: 100,00"
                aoAlterar={(valor) =>
                  atualizarCampo(
                    "valorDesconto",
                    valor
                  )
                }
              />

              <CampoNumerico
                titulo="Cashback percentual"
                valor={formulario.cashbackPercentual}
                placeholder="Ex.: 8"
                aoAlterar={(valor) =>
                  atualizarCampo(
                    "cashbackPercentual",
                    valor
                  )
                }
              />

              <CampoNumerico
                titulo="Pedido mínimo"
                valor={formulario.pedidoMinimo}
                placeholder="Ex.: 200,00"
                aoAlterar={(valor) =>
                  atualizarCampo("pedidoMinimo", valor)
                }
              />

              <CampoNumerico
                titulo="Preço original"
                valor={formulario.precoOriginal}
                placeholder="Ex.: 299,90"
                aoAlterar={(valor) =>
                  atualizarCampo("precoOriginal", valor)
                }
              />

              <CampoNumerico
                titulo="Preço da oferta"
                valor={formulario.precoOferta}
                placeholder="Ex.: 199,90"
                aoAlterar={(valor) =>
                  atualizarCampo("precoOferta", valor)
                }
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-black text-slate-950">
              Período e destaque
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Data de início
                </span>

                <input
                  type="datetime-local"
                  value={formulario.dataInicio}
                  onChange={(event) =>
                    atualizarCampo(
                      "dataInicio",
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-700">
                  Validade
                </span>

                <input
                  type="datetime-local"
                  value={formulario.validade}
                  onChange={(event) =>
                    atualizarCampo(
                      "validade",
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-slate-700">
                  Selos
                </span>

                <input
                  value={formulario.selos}
                  onChange={(event) =>
                    atualizarCampo(
                      "selos",
                      event.target.value
                    )
                  }
                  placeholder="Melhor cupom, Oferta relâmpago, Frete grátis"
                  className="rounded-xl border border-slate-300 px-4 py-3"
                />

                <span className="text-xs text-slate-500">
                  Separe os selos utilizando vírgulas.
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <input
                  type="checkbox"
                  checked={formulario.destaque}
                  onChange={(event) =>
                    atualizarCampo(
                      "destaque",
                      event.target.checked
                    )
                  }
                  className="h-5 w-5"
                />

                <span>
                  <strong className="block text-slate-950">
                    Destacar esta oportunidade
                  </strong>

                  <span className="text-sm text-slate-500">
                    Ela poderá aparecer nas áreas principais
                    da Central Economize.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fecharModal}
              disabled={salvando}
              className="rounded-xl border border-slate-300 px-5 py-3 font-black text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando
                ? "Cadastrando..."
                : "Cadastrar oportunidade"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

type CampoNumericoProps = {
  titulo: string;
  valor: string;
  placeholder: string;
  aoAlterar: (valor: string) => void;
};

function CampoNumerico({
  titulo,
  valor,
  placeholder,
  aoAlterar,
}: CampoNumericoProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-700">
        {titulo}
      </span>

      <input
        inputMode="decimal"
        value={valor}
        onChange={(event) =>
          aoAlterar(event.target.value)
        }
        placeholder={placeholder}
        className="rounded-xl border border-slate-300 px-4 py-3"
      />
    </label>
  );
}