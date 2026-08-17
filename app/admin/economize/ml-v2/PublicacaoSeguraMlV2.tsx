"use client";

import { useEffect, useState } from "react";

type ItemCandidato = {
  item_id: string;
  nome: string | null;
  imagem: string | null;
  url: string | null;
};

type Candidato = {
  id: string;
  campanha_id: string;
  titulo: string;
  valor_desconto: number | null;
  compra_minima: number | null;
  validade: string | null;
  status: string;
  cupom_publicado_id: string | null;
  publicado_em: string | null;
  itens: ItemCandidato[];
};

type Formulario = {
  item_id: string;
  link_destino: string;
  link_afiliado: string;
  codigo_publico: string;
  validado_comprador: boolean;
  confirmar_link_proprio: boolean;
};

const vazio: Formulario = {
  item_id: "",
  link_destino: "",
  link_afiliado: "",
  codigo_publico: "",
  validado_comprador: false,
  confirmar_link_proprio: false,
};

function moeda(valor: number | null) {
  if (valor === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function camposFaltantes(form: Formulario) {
  const faltantes: string[] = [];

  if (!form.item_id.trim()) faltantes.push("item participante");
  if (!form.link_destino.trim()) faltantes.push("URL original do produto");
  if (!form.codigo_publico.trim()) faltantes.push("código público");
  if (!form.link_afiliado.trim()) faltantes.push("link afiliado meli.la");
  if (!form.validado_comprador) faltantes.push("confirmação do código no checkout");
  if (!form.confirmar_link_proprio) faltantes.push("confirmação do nosso link afiliado");

  return faltantes;
}

export default function PublicacaoSeguraMlV2() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [formularios, setFormularios] = useState<Record<string, Formulario>>({});
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(
        "/api/admin/economize/cupons/ml-v2/candidatos",
        { cache: "no-store" }
      );
      const dados = (await resposta.json()) as {
        sucesso?: boolean;
        erro?: string;
        candidatos?: Candidato[];
      };

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha carregando candidatos aprovados.");
      }

      const lista = dados.candidatos || [];
      setCandidatos(lista);
      setFormularios((atuais) => {
        const proximos = { ...atuais };
        for (const candidato of lista) {
          const primeiroItem = candidato.itens[0];
          if (!proximos[candidato.id]) {
            proximos[candidato.id] = {
              ...vazio,
              item_id: primeiroItem?.item_id || "",
              link_destino: primeiroItem?.url || "",
            };
          } else if (!proximos[candidato.id].link_destino && primeiroItem?.url) {
            proximos[candidato.id] = {
              ...proximos[candidato.id],
              link_destino: primeiroItem.url,
            };
          }
        }
        return proximos;
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function atualizar(id: string, parcial: Partial<Formulario>) {
    setErro("");
    setMensagem("");
    setFormularios((atuais) => ({
      ...atuais,
      [id]: { ...(atuais[id] || vazio), ...parcial },
    }));
  }

  async function publicar(candidato: Candidato) {
    const formulario = formularios[candidato.id] || vazio;
    const faltantes = camposFaltantes(formulario);

    if (faltantes.length > 0) {
      setErro(`Falta preencher: ${faltantes.join(", ")}.`);
      return;
    }

    try {
      setPublicando(candidato.id);
      setErro("");
      setMensagem("");

      const resposta = await fetch(
        `/api/admin/economize/cupons/ml-v2/candidatos/${candidato.id}/publicar`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(formulario),
        }
      );

      const dados = (await resposta.json()) as {
        sucesso?: boolean;
        erro?: string;
        oferta_id?: string;
      };

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Publicação não concluída.");
      }

      setMensagem(
        `Publicado com segurança. Oferta ${dados.oferta_id || "criada"} e link afiliado validado.`
      );
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro inesperado ao publicar.");
    } finally {
      setPublicando(null);
    }
  }

  const aprovados = candidatos.filter((item) => item.status === "aprovado");
  const publicados = candidatos.filter((item) => item.status === "publicado");

  return (
    <section id="publicacao-segura-ml-v2" className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm scroll-mt-24">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-emerald-700">
            Etapa final ML V2
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Publicação segura
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Aqui só entram candidatos já aprovados. A URL direta do item selecionado já vem preenchida automaticamente. A publicação exige código público confirmado no checkout e um link curto meli.la gerado na nossa conta afiliada. O backend segue o meli.la e bloqueia a publicação se ele não terminar no item selecionado.
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
          className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 font-black text-slate-700 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">
            Aprovados aguardando publicação
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">{aprovados.length}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Publicados pelo V2
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">{publicados.length}</p>
        </div>
      </div>

      {erro && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
          {mensagem}
        </div>
      )}

      {carregando ? (
        <p className="mt-5 text-sm font-bold text-slate-500">Carregando candidatos...</p>
      ) : aprovados.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
          Nenhum candidato aprovado aguardando publicação. Aprove um candidato no painel acima para liberar esta etapa.
        </p>
      ) : (
        <div className="mt-5 grid gap-5">
          {aprovados.map((candidato) => {
            const form = formularios[candidato.id] || vazio;
            const ocupado = publicando === candidato.id;
            const faltantes = camposFaltantes(form);
            const pronto = faltantes.length === 0;

            return (
              <article
                id={`afiliado-${candidato.id}`}
                key={candidato.id}
                className="scroll-mt-24 rounded-2xl border border-slate-200 p-5 target:border-emerald-400 target:ring-4 target:ring-emerald-100"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-black text-slate-950">{candidato.titulo}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Campanha {candidato.campanha_id} · {moeda(candidato.valor_desconto)} OFF
                      {candidato.compra_minima !== null
                        ? ` · mínimo ${moeda(candidato.compra_minima)}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                    Aprovado
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Item participante
                    <select
                      value={form.item_id}
                      onChange={(event) => {
                        const itemId = event.target.value;
                        const itemSelecionado = candidato.itens.find((item) => item.item_id === itemId);
                        atualizar(candidato.id, {
                          item_id: itemId,
                          link_destino: itemSelecionado?.url || "",
                        });
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2"
                    >
                      {candidato.itens.map((item) => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.item_id} — {item.nome || "produto"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-slate-700">
                    Código público validado no checkout
                    <input
                      value={form.codigo_publico}
                      onChange={(event) =>
                        atualizar(candidato.id, { codigo_publico: event.target.value.toUpperCase() })
                      }
                      placeholder="Ex.: DESCONTO15"
                      className={`rounded-xl border px-3 py-2 ${
                        form.codigo_publico.trim()
                          ? "border-slate-300"
                          : "border-amber-300 bg-amber-50"
                      }`}
                    />
                    {!form.codigo_publico.trim() && (
                      <span className="text-xs font-bold text-amber-700">
                        Obrigatório. Use somente o código público realmente validado no checkout.
                      </span>
                    )}
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
                    URL direta do produto no Mercado Livre
                    <input
                      value={form.link_destino}
                      readOnly
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-slate-700 lg:col-span-2">
                    Nosso link afiliado meli.la
                    <input
                      value={form.link_afiliado}
                      onChange={(event) =>
                        atualizar(candidato.id, { link_afiliado: event.target.value })
                      }
                      placeholder="https://meli.la/..."
                      className={`rounded-xl border bg-emerald-50 px-3 py-2 ${
                        form.link_afiliado.trim() ? "border-emerald-300" : "border-amber-300"
                      }`}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.validado_comprador}
                      onChange={(event) =>
                        atualizar(candidato.id, { validado_comprador: event.target.checked })
                      }
                      className="mt-1"
                    />
                    Confirmei em conta compradora que este código funciona para o item e as regras acima.
                  </label>
                  <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.confirmar_link_proprio}
                      onChange={(event) =>
                        atualizar(candidato.id, { confirmar_link_proprio: event.target.checked })
                      }
                      className="mt-1"
                    />
                    Confirmei que o meli.la foi gerado pela nossa conta de afiliado do Achados do Casal.
                  </label>
                </div>

                {!pronto && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    Falta preencher: {faltantes.join(", ")}.
                  </div>
                )}

                <button
                  type="button"
                  disabled={ocupado || !pronto}
                  onClick={() => publicar(candidato)}
                  title={!pronto ? `Falta preencher: ${faltantes.join(", ")}` : undefined}
                  className="mt-5 cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-100"
                >
                  {ocupado
                    ? "Validando e publicando..."
                    : pronto
                      ? "Publicar com link afiliado validado"
                      : "Complete os campos obrigatórios"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
