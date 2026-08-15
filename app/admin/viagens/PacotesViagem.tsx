"use client";

import { useEffect, useMemo, useState } from "react";

type Pacote = {
  id: string;
  status: string;
  titulo: string;
  parceiro: string;
  link_original?: string | null;
  radar_slug?: string | null;
  origem_codigo: string;
  destino_codigo: string;
  destino_nome?: string | null;
  data_ida: string;
  data_volta: string;
  hotel_nome: string;
  noites: number;
  adultos: number;
  criancas: number;
  companhia_aerea?: string | null;
  preco_total: number;
  preco_por_pessoa?: number | null;
  moeda: string;
  link_afiliado: string;
  destaque: boolean;
};

type RespostaPacotes = {
  sucesso?: boolean;
  erro?: string;
  aviso?: string;
  schema_pendente?: boolean;
  pacotes?: Pacote[];
};

type DadosPreparados = {
  link_original?: string;
  titulo?: string;
  parceiro?: string;
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
  moeda?: string;
  imagem_url?: string;
  observacoes?: string;
  radar_slug?: string;
  confianca?: "alta" | "media" | "baixa";
  campos_detectados?: string[];
};

type RespostaPreparar = {
  sucesso?: boolean;
  erro?: string;
  dados?: DadosPreparados;
};

const RADARES = [
  "",
  "poa-orlando",
  "poa-new-york",
  "poa-miami",
  "poa-los-angeles",
  "poa-lisboa",
  "gru-orlando",
  "gru-new-york",
  "gru-miami",
  "gru-los-angeles",
  "gru-lisboa",
  "gru-madrid",
  "gig-orlando",
  "gig-new-york",
  "gig-miami",
  "gig-los-angeles",
  "gig-lisboa",
];

const INICIAL = {
  titulo: "",
  parceiro: "Decolar",
  link_original: "",
  link_afiliado: "",
  radar_slug: "",
  radar_preco_referencia: "",
  radar_ida_referencia: "",
  radar_volta_referencia: "",
  origem_codigo: "",
  destino_codigo: "",
  destino_nome: "",
  data_ida: "",
  data_volta: "",
  hotel_nome: "",
  hotel_categoria: "",
  regime_hospedagem: "",
  noites: "",
  adultos: "2",
  criancas: "0",
  companhia_aerea: "",
  bagagem: "",
  preco_total: "",
  preco_por_pessoa: "",
  moeda: "BRL",
  imagem_url: "",
  observacoes: "",
  validade: "",
  destaque: false,
  status: "rascunho",
};

function moeda(valor: number | null | undefined, codigo = "BRL") {
  if (!Number.isFinite(Number(valor))) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: codigo,
  }).format(Number(valor));
}

function diferencaNoites(ida?: string, volta?: string) {
  if (!ida || !volta) return "";

  const inicio = new Date(`${ida}T12:00:00`).getTime();
  const fim = new Date(`${volta}T12:00:00`).getTime();

  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) {
    return "";
  }

  return String(Math.round((fim - inicio) / 86400000));
}

export default function PacotesViagem() {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [schemaPendente, setSchemaPendente] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(INICIAL);

  const totalAtivos = useMemo(
    () => pacotes.filter((pacote) => pacote.status === "ativo").length,
    [pacotes]
  );

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch("/api/admin/viagens/pacotes", {
        cache: "no-store",
      });

      const dados = (await resposta.json()) as RespostaPacotes;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Falha ao carregar pacotes.");
      }

      setPacotes(dados.pacotes ?? []);
      setSchemaPendente(Boolean(dados.schema_pendente));
      setAviso(dados.aviso || "");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar pacotes."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function alterar(nome: keyof typeof INICIAL, valor: string | boolean) {
    setForm((atual) => ({ ...atual, [nome]: valor }));
  }

  async function prepararPacote() {
    const link = form.link_original.trim();

    if (!link) {
      setErro("Cole primeiro o link original do pacote na Decolar.");
      return;
    }

    try {
      setPreparando(true);
      setErro("");
      setAviso("");

      const resposta = await fetch(
        "/api/admin/viagens/pacotes/preparar",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ link }),
        }
      );

      const resultado = (await resposta.json()) as RespostaPreparar;

      if (!resposta.ok || !resultado.sucesso || !resultado.dados) {
        throw new Error(
          resultado.erro || "Não foi possível preparar o pacote automaticamente."
        );
      }

      const dados = resultado.dados;

      setForm((atual) => ({
        ...atual,
        link_original: dados.link_original || atual.link_original,
        titulo: dados.titulo || atual.titulo,
        parceiro: dados.parceiro || atual.parceiro,
        radar_slug: dados.radar_slug || atual.radar_slug,
        origem_codigo: dados.origem_codigo || atual.origem_codigo,
        destino_codigo: dados.destino_codigo || atual.destino_codigo,
        destino_nome: dados.destino_nome || atual.destino_nome,
        data_ida: dados.data_ida || atual.data_ida,
        data_volta: dados.data_volta || atual.data_volta,
        noites:
          dados.noites != null
            ? String(dados.noites)
            : atual.noites || diferencaNoites(dados.data_ida, dados.data_volta),
        hotel_nome: dados.hotel_nome || atual.hotel_nome,
        hotel_categoria: dados.hotel_categoria || atual.hotel_categoria,
        regime_hospedagem:
          dados.regime_hospedagem || atual.regime_hospedagem,
        adultos:
          dados.adultos != null ? String(dados.adultos) : atual.adultos,
        criancas:
          dados.criancas != null ? String(dados.criancas) : atual.criancas,
        companhia_aerea:
          dados.companhia_aerea || atual.companhia_aerea,
        bagagem: dados.bagagem || atual.bagagem,
        preco_total:
          dados.preco_total != null
            ? String(dados.preco_total)
            : atual.preco_total,
        preco_por_pessoa:
          dados.preco_por_pessoa != null
            ? String(dados.preco_por_pessoa)
            : atual.preco_por_pessoa,
        moeda: dados.moeda || atual.moeda,
        imagem_url: dados.imagem_url || atual.imagem_url,
        observacoes: dados.observacoes || atual.observacoes,
      }));

      const quantidade = resultado.dados.campos_detectados?.length ?? 0;
      const confianca = resultado.dados.confianca ?? "baixa";

      setAviso(
        `Pacote preparado automaticamente: ${quantidade} grupo(s) de dados detectados. Confiança ${confianca}. Revise os campos e depois cole o link afiliado.`
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao preparar o pacote."
      );
    } finally {
      setPreparando(false);
    }
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();

    try {
      setSalvando(true);
      setErro("");
      setAviso("");

      const resposta = await fetch("/api/admin/viagens/pacotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          noites: Number(form.noites),
          adultos: Number(form.adultos),
          criancas: Number(form.criancas),
          preco_total: Number(form.preco_total),
          preco_por_pessoa: form.preco_por_pessoa
            ? Number(form.preco_por_pessoa)
            : null,
          radar_preco_referencia: form.radar_preco_referencia
            ? Number(form.radar_preco_referencia)
            : null,
          validade: form.validade
            ? new Date(form.validade).toISOString()
            : null,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        if (dados.schema_pendente) {
          setSchemaPendente(true);
        }

        throw new Error(dados.erro || "Falha ao cadastrar pacote.");
      }

      setForm(INICIAL);
      setAberto(false);
      setAviso("Pacote cadastrado com sucesso.");
      await carregar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao salvar pacote."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-amber-600">
            Pacotes manuais
          </p>
          <h2 className="mt-2 text-2xl font-black">Aéreo + hotel</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Use as melhores janelas encontradas pelo Radar para montar pacotes
            em parceiros como Decolar. O pacote é uma oferta comercial separada
            e não altera a classificação independente do Radar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAberto((valor) => !valor)}
          className="rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400"
        >
          {aberto ? "Fechar cadastro" : "+ Adicionar pacote"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Pacotes cadastrados
          </p>
          <p className="mt-2 text-3xl font-black">{pacotes.length}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Ativos
          </p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{totalAtivos}</p>
        </div>
        <div className="rounded-2xl bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-violet-700">
            Parceiro inicial
          </p>
          <p className="mt-2 font-black">Decolar</p>
        </div>
      </div>

      {schemaPendente && (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          ⚠️ Base de Pacotes ainda não aplicada no Supabase.
        </div>
      )}

      {aviso && !schemaPendente && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
          {aviso}
        </div>
      )}

      {erro && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          {erro}
        </div>
      )}

      {aberto && (
        <form onSubmit={salvar} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-6 rounded-2xl border-2 border-violet-200 bg-violet-50 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-violet-700">
              ✨ Preenchimento automático
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Cole o link original do pacote na Decolar
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Vamos tentar preencher destino, datas, hotel, noites, preço, imagem,
              bagagem e outros dados. Depois você revisa e cola o link afiliado.
            </p>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <input
                type="url"
                value={form.link_original}
                onChange={(e) => alterar("link_original", e.target.value)}
                placeholder="https://www.decolar.com/..."
                className="min-w-0 flex-1 rounded-xl border border-violet-300 bg-white px-4 py-3"
              />

              <button
                type="button"
                onClick={prepararPacote}
                disabled={preparando || !form.link_original.trim()}
                className="rounded-xl bg-violet-700 px-6 py-3 font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {preparando ? "✨ Preparando..." : "✨ Preparar pacote"}
              </button>
            </div>

            <p className="mt-3 text-xs font-bold text-violet-700">
              O link original fica salvo para futuras atualizações de preço. Ele não substitui o link afiliado.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="xl:col-span-2">
              <span className="text-sm font-black">Título do pacote *</span>
              <input
                value={form.titulo}
                onChange={(e) => alterar("titulo", e.target.value)}
                placeholder="Ex.: Madrid 9 noites + voo saindo de GRU"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Parceiro *</span>
              <select
                value={form.parceiro}
                onChange={(e) => alterar("parceiro", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option>Decolar</option>
              </select>
            </label>

            <label className="xl:col-span-3">
              <span className="text-sm font-black">Link afiliado *</span>
              <input
                type="url"
                value={form.link_afiliado}
                onChange={(e) => alterar("link_afiliado", e.target.value)}
                placeholder="Cole aqui o link afiliado da Decolar depois de revisar o pacote"
                required
                className="mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3"
              />
              <span className="mt-1 block text-xs font-bold text-emerald-700">
                Este é o link usado no botão público para monetização.
              </span>
            </label>

            <label>
              <span className="text-sm font-black">Radar de referência</span>
              <select
                value={form.radar_slug}
                onChange={(e) => alterar("radar_slug", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                {RADARES.map((radar) => (
                  <option key={radar || "sem-radar"} value={radar}>
                    {radar || "Sem vínculo"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-black">Preço do voo no Radar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.radar_preco_referencia}
                onChange={(e) => alterar("radar_preco_referencia", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-sm font-black">Ida Radar</span>
                <input
                  type="date"
                  value={form.radar_ida_referencia}
                  onChange={(e) => alterar("radar_ida_referencia", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                />
              </label>
              <label>
                <span className="text-sm font-black">Volta Radar</span>
                <input
                  type="date"
                  value={form.radar_volta_referencia}
                  onChange={(e) => alterar("radar_volta_referencia", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                />
              </label>
            </div>

            <label>
              <span className="text-sm font-black">Origem *</span>
              <input
                value={form.origem_codigo}
                onChange={(e) => alterar("origem_codigo", e.target.value.toUpperCase())}
                placeholder="GRU"
                maxLength={5}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase"
              />
            </label>

            <label>
              <span className="text-sm font-black">Destino *</span>
              <input
                value={form.destino_codigo}
                onChange={(e) => alterar("destino_codigo", e.target.value.toUpperCase())}
                placeholder="MAD"
                maxLength={5}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase"
              />
            </label>

            <label>
              <span className="text-sm font-black">Nome do destino</span>
              <input
                value={form.destino_nome}
                onChange={(e) => alterar("destino_nome", e.target.value)}
                placeholder="Madrid"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Ida *</span>
              <input
                type="date"
                value={form.data_ida}
                onChange={(e) => alterar("data_ida", e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Volta *</span>
              <input
                type="date"
                value={form.data_volta}
                onChange={(e) => alterar("data_volta", e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Noites *</span>
              <input
                type="number"
                min="1"
                value={form.noites}
                onChange={(e) => alterar("noites", e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label className="xl:col-span-2">
              <span className="text-sm font-black">Hotel *</span>
              <input
                value={form.hotel_nome}
                onChange={(e) => alterar("hotel_nome", e.target.value)}
                placeholder="Nome do hotel"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Categoria hotel</span>
              <input
                value={form.hotel_categoria}
                onChange={(e) => alterar("hotel_categoria", e.target.value)}
                placeholder="4 estrelas"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Regime</span>
              <input
                value={form.regime_hospedagem}
                onChange={(e) => alterar("regime_hospedagem", e.target.value)}
                placeholder="Café da manhã"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Companhia aérea</span>
              <input
                value={form.companhia_aerea}
                onChange={(e) => alterar("companhia_aerea", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Bagagem</span>
              <input
                value={form.bagagem}
                onChange={(e) => alterar("bagagem", e.target.value)}
                placeholder="1 mala de 23kg"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Adultos *</span>
              <input
                type="number"
                min="1"
                value={form.adultos}
                onChange={(e) => alterar("adultos", e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Crianças</span>
              <input
                type="number"
                min="0"
                value={form.criancas}
                onChange={(e) => alterar("criancas", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Preço total *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.preco_total}
                onChange={(e) => alterar("preco_total", e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Preço por pessoa</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.preco_por_pessoa}
                onChange={(e) => alterar("preco_por_pessoa", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label>
              <span className="text-sm font-black">Status</span>
              <select
                value={form.status}
                onChange={(e) => alterar("status", e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              >
                <option value="rascunho">Rascunho</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>

            <label className="xl:col-span-3">
              <span className="text-sm font-black">Imagem</span>
              <input
                type="url"
                value={form.imagem_url}
                onChange={(e) => alterar("imagem_url", e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label className="xl:col-span-3">
              <span className="text-sm font-black">Observações</span>
              <textarea
                value={form.observacoes}
                onChange={(e) => alterar("observacoes", e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={(e) => alterar("destaque", e.target.checked)}
              />
              <span className="text-sm font-black">Destacar pacote</span>
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={salvando || schemaPendente}
              className="rounded-xl bg-slate-950 px-6 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar pacote"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-black">Pacote</th>
              <th className="px-4 py-3 font-black">Rota / datas</th>
              <th className="px-4 py-3 font-black">Hotel</th>
              <th className="px-4 py-3 font-black">Preço</th>
              <th className="px-4 py-3 font-black">Parceiro</th>
              <th className="px-4 py-3 font-black">Status</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Carregando pacotes...
                </td>
              </tr>
            ) : pacotes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum pacote cadastrado ainda.
                </td>
              </tr>
            ) : (
              pacotes.map((pacote) => (
                <tr key={pacote.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold">
                    {pacote.titulo}
                    {pacote.radar_slug && (
                      <div className="mt-1 text-xs font-medium text-violet-600">
                        Radar: {pacote.radar_slug}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold">
                      {pacote.origem_codigo} → {pacote.destino_codigo}
                    </div>
                    <div className="text-xs text-slate-500">
                      {pacote.data_ida} a {pacote.data_volta}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {pacote.hotel_nome}
                    <div className="text-xs text-slate-500">
                      {pacote.noites} noites
                    </div>
                  </td>
                  <td className="px-4 py-3 font-black">
                    {moeda(pacote.preco_total, pacote.moeda)}
                    {pacote.preco_por_pessoa && (
                      <div className="text-xs font-medium text-slate-500">
                        {moeda(pacote.preco_por_pessoa, pacote.moeda)} / pessoa
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={pacote.link_afiliado}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      {pacote.parceiro} ↗
                    </a>
                    {pacote.link_original && (
                      <div className="mt-1">
                        <a
                          href={pacote.link_original}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-slate-400 hover:underline"
                        >
                          Link original ↗
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold">{pacote.status}</span>
                    {pacote.destaque && (
                      <div className="text-xs font-bold text-amber-600">⭐ Destaque</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
