"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CadastroModal from "./CadastroModal";

export default function AdminPage() {
  const supabase = createClient();
  const [abrirFormulario, setAbrirFormulario] = useState(false);
  const [abrirModalCadastro, setAbrirModalCadastro] = useState(false);
const [modoCadastro, setModoCadastro] = useState<"ia" | "manual" | null>(null);
const [produtos, setProdutos] = useState<any[]>([]);
const [buscaAdmin, setBuscaAdmin] = useState("");
const [lojaAdmin, setLojaAdmin] = useState("Todas");
const [paginaAtual, setPaginaAtual] = useState(1);
const [ordenacao, setOrdenacao] = useState("recentes");
const [mensagemSucesso, setMensagemSucesso] = useState("");
const [preparandoProduto, setPreparandoProduto] = useState(false);
const [linkProdutoDireto, setLinkProdutoDireto] = useState("");
const totalProdutos = produtos.length;
const totalPrecosAlterados = produtos.filter(
  (produto) => produto.preco_alterado
).length;

const totalDestaques = produtos.filter(
  (produto) => produto.destaque
).length;

const totalAtivos = produtos.filter(
  (produto) => produto.ativo
).length;

const totalLojas = new Set(
  produtos.map((produto) => produto.loja)
).size;
const [imagem, setImagem] = useState<File | null>(null);
const [imagensGaleria, setImagensGaleria] = useState<string[]>([]);
const [imagensExtras, setImagensExtras] = useState<File[]>([]);
const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formulario, setFormulario] = useState({
  nome: "",
  categoria: "",
  loja: "Mercado Livre",
  precoAntigo: "",
  precoAtual: "",
  link: "",
  linkAfiliado: "",
  cupom: "",
  imagem: "",
  parcelas: "",
freteGratis: false,
avaliacao: "",
vendas: "",
  destaque: false,
  ativo: true,
  temEmCasa: false,
  reviewCompleta: false,
  videoUrl: "",
  opiniaoCasal: "",
notaCasal: "",
tempoDeUso: "",
pontosPositivos: "",
pontosNegativos: "",

});
async function carregarProdutos() {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  setProdutos(data || []);
}

useEffect(() => {
  carregarProdutos();

}, []);
async function sair() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Erro ao sair:", error);
    alert("Não foi possível sair.");
    return;
  }

  window.location.assign("/login");
}

async function editarProduto(produto: any) {
  setEditandoId(produto.id);

  const { data: imagensSalvas, error: erroImagens } =
    await supabase
      .from("produto_imagens")
      .select("url")
      .eq("produto_id", produto.id)
      .order("ordem", { ascending: true });

  if (erroImagens) {
    console.error("Erro ao carregar galeria:", erroImagens);
  }

  setFormulario({
    nome: produto.nome,
    categoria: produto.categoria,
    loja: produto.loja,
    precoAntigo: produto.preco_antigo?.toString() || "",
    precoAtual: produto.preco_atual?.toString() || "",
    link: produto.link || "",
    linkAfiliado: produto.link_afiliado ?? "",
    cupom: produto.cupom || "",
    imagem: produto.imagem || "",
    parcelas: produto.parcelas || "",
    freteGratis: produto.frete_gratis ?? false,
    avaliacao: produto.avaliacao?.toString() || "",
    vendas: produto.vendas || "",
    destaque: produto.destaque || false,
    ativo: produto.ativo ?? true,
    temEmCasa: produto.tem_em_casa ?? false,
    reviewCompleta: produto.review_completa ?? false,
    videoUrl: produto.video_url ?? "",
    opiniaoCasal: produto.opiniao_casal ?? "",
    notaCasal: produto.nota_casal?.toString() ?? "",
    tempoDeUso: produto.tempo_de_uso ?? "",
    pontosPositivos: produto.pontos_positivos ?? "",
    pontosNegativos: produto.pontos_negativos ?? "",
  });

  setLinkProdutoDireto(produto.link || "");
  setImagem(null);
  setImagensGaleria(
    imagensSalvas?.map((item) => item.url) || []
  );
  setImagensExtras([]);
  setAbrirFormulario(true);
}

async function excluirProduto(id: number) {
  const produto = produtos.find((p) => p.id === id);

const confirmar = window.confirm(
  `Tem certeza que deseja excluir?\n\n${produto?.nome || "Produto selecionado"}`
);

if (!confirmar) return;

  const { error } = await supabase
    .from("produtos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  carregarProdutos();
}

async function prepararProdutoComIa() {
if (!linkProdutoDireto.trim()) {
  alert("Informe o link direto do produto.");
  return;
}
  setPreparandoProduto(true);

  try {
    console.log(">>> ENVIANDO PARA API");
    const resposta = await fetch("/api/preparar-produto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  link: linkProdutoDireto.trim(),
}),
    });

    const resultado = await resposta.json();
    console.log(">>> RETORNO DA API", resultado);

    if (!resposta.ok) {
      alert(resultado.error || "Não foi possível preparar o produto.");
      return;
    }

    const dados = resultado.dados;

setFormulario((formularioAtual) => ({
  ...formularioAtual,
  link: linkProdutoDireto.trim(),
  nome: dados.nome || formularioAtual.nome,
  categoria: dados.categoria || formularioAtual.categoria,
  loja: dados.loja || formularioAtual.loja,
  precoAntigo: dados.precoAntigo || formularioAtual.precoAntigo,
  precoAtual: dados.precoAtual || formularioAtual.precoAtual,
  imagem: dados.imagem || formularioAtual.imagem,
  parcelas: dados.parcelas || formularioAtual.parcelas,
freteGratis: dados.freteGratis ?? formularioAtual.freteGratis,
avaliacao:
  dados.avaliacao?.toString() ||
  formularioAtual.avaliacao,

vendas:
  dados.vendas ||
  formularioAtual.vendas,
}));
setImagensGaleria(dados.imagensGaleria || []);
setPreparandoProduto(false);

setTimeout(() => {
  alert("Produto preparado com sucesso.");
}, 100);
  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com a API.");
  } finally {
    setPreparandoProduto(false);
  }
}
function limparFormularioProduto() {
  setEditandoId(null);
  setImagem(null);
  setImagensGaleria([]);
  setImagensExtras([]);
  setLinkProdutoDireto("");

  setFormulario({
    nome: "",
    categoria: "",
    loja: "Mercado Livre",
    precoAntigo: "",
    precoAtual: "",
    link: "",
    linkAfiliado: "",
    cupom: "",
    imagem: "",
    parcelas: "",
    freteGratis: false,
    avaliacao: "",
    vendas: "",
    destaque: false,
    ativo: true,
    temEmCasa: false,
    reviewCompleta: false,
    videoUrl: "",
    opiniaoCasal: "",
    notaCasal: "",
    tempoDeUso: "",
    pontosPositivos: "",
    pontosNegativos: "",
  });
}
async function salvarProduto() {
  let imagemUrl = formulario.imagem || "";

if (imagem) {
  const nomeArquivo = `${Date.now()}-${imagem.name}`;

  const { error: erroUpload } = await supabase.storage
    .from("produtos")
    .upload(nomeArquivo, imagem);

  if (erroUpload) {
  console.error(erroUpload);
  alert(erroUpload.message);
  return;
}

imagemUrl = supabase.storage
  .from("produtos")
  .getPublicUrl(nomeArquivo).data.publicUrl;
}

const dadosProduto = {
  nome: formulario.nome,
  categoria: formulario.categoria,
  loja: formulario.loja,
  preco_antigo: Number(formulario.precoAntigo) || null,
  preco_atual: Number(formulario.precoAtual),
  imagem: imagemUrl,
  link: formulario.link,
  link_afiliado: formulario.linkAfiliado,
  cupom: formulario.cupom,
 parcelas: formulario.parcelas || null,
frete_gratis: formulario.freteGratis,
avaliacao: formulario.avaliacao
  ? Number(formulario.avaliacao)
  : null,
vendas: formulario.vendas || null,
  destaque: formulario.destaque,
    ativo: formulario.ativo,
    tem_em_casa: formulario.temEmCasa,
    review_completa: formulario.reviewCompleta,
    video_url: formulario.videoUrl || null,
    opiniao_casal: formulario.opiniaoCasal || null,
nota_casal: formulario.notaCasal
  ? Number(formulario.notaCasal)
  : null,
tempo_de_uso: formulario.tempoDeUso || null,
pontos_positivos: formulario.pontosPositivos || null,
pontos_negativos: formulario.pontosNegativos || null,
};

let error;
let produtoSalvo;

if (editandoId) {
  const { data, error: erroUpdate } = await supabase
    .from("produtos")
    .update(dadosProduto)
    .eq("id", editandoId)
    .select()
    .single();

  produtoSalvo = data;
  error = erroUpdate;
} else {
  const { data, error: erroInsert } = await supabase
    .from("produtos")
    .insert(dadosProduto)
    .select()
    .single();

  produtoSalvo = data;
  error = erroInsert;
}

 if (error) {
  console.error(error);
  alert(error.message);
  return;
}if (imagensExtras.length > 0) {
  for (let i = 0; i < imagensExtras.length; i++) {
    const arquivo = imagensExtras[i];

    const nomeArquivo =
      `${Date.now()}-${i}-${arquivo.name}`;

    const { error: erroUploadExtra } =
      await supabase.storage
        .from("produtos")
        .upload(nomeArquivo, arquivo);

    if (erroUploadExtra) {
      console.error(erroUploadExtra);
      continue;
    }

    const url =
      supabase.storage
        .from("produtos")
        .getPublicUrl(nomeArquivo)
        .data.publicUrl;
console.log("Produto salvo:", produtoSalvo);

console.log({
  produto_id: produtoSalvo?.id,
  url,
  ordem: i + 1,
});
    await supabase
      .from("produto_imagens")
            .insert({
        produto_id: produtoSalvo.id,
        url,
        ordem: i + 1,
      });
  }
}
if (editandoId) {
  await supabase
    .from("produto_imagens")
    .delete()
    .eq("produto_id", produtoSalvo.id);
}
if (imagensGaleria.length > 0) {
  for (let i = 0; i < imagensGaleria.length; i++) {
    const url = imagensGaleria[i];

    const { error: erroImagemAutomatica } = await supabase
      .from("produto_imagens")
      .insert({
        produto_id: produtoSalvo.id,
        url,
        ordem: imagensExtras.length + i + 1,
      });

    if (erroImagemAutomatica) {
      console.error(
        "Erro ao salvar imagem automática:",
        erroImagemAutomatica
      );
    }
  }
}
setMensagemSucesso("Produto salvo com sucesso!");

setTimeout(() => {
  setMensagemSucesso("");
}, 3000);
    
  setEditandoId(null);
setImagem(null);
carregarProdutos();

  setFormulario({
  nome: "",
  categoria: "",
  loja: "Mercado Livre",
  precoAntigo: "",
  precoAtual: "",
  link: "",
  linkAfiliado: "",
  cupom: "",
  imagem: "",
  parcelas: "",
freteGratis: false,
avaliacao: "",
vendas: "",
  destaque: false,
  ativo: true,
  temEmCasa: false,
  reviewCompleta: false,
  videoUrl: "",
  opiniaoCasal: "",
notaCasal: "",
tempoDeUso: "",
pontosPositivos: "",
pontosNegativos: "",
});

  setAbrirFormulario(false);

}

const produtosFiltrados = produtos.filter((produto) => {
  const termo = buscaAdmin.toLowerCase();

  const correspondeBusca =
    produto.nome.toLowerCase().includes(termo) ||
    produto.loja.toLowerCase().includes(termo) ||
    produto.categoria.toLowerCase().includes(termo);

  const correspondeLoja =
    lojaAdmin === "Todas" || produto.loja === lojaAdmin;

  return correspondeBusca && correspondeLoja;
});
const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
  switch (ordenacao) {
    case "nome-az":
      return a.nome.localeCompare(b.nome);

    case "nome-za":
      return b.nome.localeCompare(a.nome);

    case "destaques":
      return Number(b.destaque) - Number(a.destaque);

    case "ativos":
      return Number(b.ativo) - Number(a.ativo);

    case "recentes":
    default:
      return b.id - a.id;
  }
});
const produtosPorPagina = 10;

const totalPaginas = Math.max(
  1,
  Math.ceil(produtosOrdenados.length / produtosPorPagina)
);

const indiceInicial = (paginaAtual - 1) * produtosPorPagina;
const indiceFinal = indiceInicial + produtosPorPagina;

const produtosPaginados = produtosOrdenados.slice(
  indiceInicial,
  indiceFinal
);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-950">
        {mensagemSucesso && (
  <div className="fixed right-6 top-6 z-[100] rounded-xl bg-green-600 px-5 py-4 font-bold text-white shadow-xl">
    ✅ {mensagemSucesso}
  </div>
 )}{totalPrecosAlterados > 0 && (
  <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-lg font-bold text-yellow-900">
        ⚠ {totalPrecosAlterados} produto(s) tiveram alteração de preço.
      </p>

      <p className="mt-1 text-sm text-yellow-700">
        Revise as alterações antes de atualizar os preços publicados.
      </p>
    </div>

   <Link
  href="/admin/monitor"
  className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-yellow-950 hover:bg-yellow-400"
>
  Revisar alterações
</Link>
  </div>
)}

<div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-pink-500">
              Achados do Casal
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Painel Administrativo
            </h1>

            <p className="mt-2 text-slate-600">
              Cadastre, edite e organize as ofertas do site.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
  <div className="rounded-2xl bg-white p-6 shadow">
    <p className="text-sm text-slate-500">Produtos</p>
    <p className="mt-2 text-3xl font-black">{totalProdutos}</p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow">
    <p className="text-sm text-slate-500">Em destaque</p>
    <p className="mt-2 text-3xl font-black text-pink-500">
      {totalDestaques}
    </p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow">
    <p className="text-sm text-slate-500">Ativos</p>
    <p className="mt-2 text-3xl font-black text-green-600">
      {totalAtivos}
    </p>
  </div>

  <div className="rounded-2xl bg-white p-6 shadow">
    <p className="text-sm text-slate-500">Lojas</p>
    <p className="mt-2 text-3xl font-black">
      {totalLojas}
    </p>
  </div>
</div>
          </div>
<div className="flex items-center gap-3">
  <Link
    href="/admin"
    className="rounded-xl border border-slate-300 bg-white px-5 py-4 font-black text-slate-700 hover:bg-slate-50"
  >
    📦 Produtos
  </Link>

  <Link
    href="/admin/monitor"
    className="rounded-xl border border-slate-300 bg-white px-5 py-4 font-black text-slate-700 hover:bg-slate-50"
  >
    📈 Monitor
  </Link>

  <button
    type="button"
    onClick={sair}
    className="rounded-xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-700 hover:bg-slate-50"
  >
    Sair
  </button>

  <button
    type="button"
    onClick={() => setAbrirModalCadastro(true)}
    className="rounded-xl bg-blue-950 px-6 py-4 font-black text-white hover:bg-blue-900"
  >
    + Novo Produto
  </button>
</div>
        </div>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-black">
            Produtos cadastrados
          </h2> 
          <p className="mt-1 text-sm text-slate-500">
  Exibindo {produtosFiltrados.length} de {produtos.length} produtos
</p>
          
  <div className="mt-4 flex gap-3">
  <input
    type="search"
    placeholder="Pesquisar por nome, loja ou categoria..."
    value={buscaAdmin}
    onChange={(e) => setBuscaAdmin(e.target.value)}
    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-900"
  />

  <select
    value={lojaAdmin}
    onChange={(e) => setLojaAdmin(e.target.value)}
    className="rounded-xl border border-slate-300 bg-white px-4 py-3"
  >
    <option>Todas</option>

    {[...new Set(produtos.map((p) => p.loja))].map((loja) => (
      <option key={loja} value={loja}>
        {loja}
      </option>
    ))}
 </select>

<select
  value={ordenacao}
  onChange={(e) => {
    setOrdenacao(e.target.value);
    setPaginaAtual(1);
  }}
  className="rounded-xl border border-slate-300 bg-white px-4 py-3"
>
  <option value="recentes">🕒 Mais recentes</option>
  <option value="nome-az">🔤 Nome A → Z</option>
  <option value="nome-za">🔤 Nome Z → A</option>
  <option value="destaques">⭐ Destaques primeiro</option>
  <option value="ativos">🟢 Ativos primeiro</option>
</select>

</div>

          <div className="mt-6 space-y-3">

  {produtos.length === 0 ? (

    <div className="py-12 text-center">
  <div className="text-5xl">🔍</div>

  <h3 className="mt-4 text-xl font-bold">
    Nenhum produto encontrado
  </h3>

  <p className="mt-2 text-slate-500">
    Tente alterar a pesquisa ou os filtros.
  </p>
</div>

  ) : (

    produtosPaginados.map((produto: any) => (

      <div
        key={produto.id}
        className="flex items-center justify-between rounded-xl border p-4"
      >

        <div className="flex items-center gap-4">

  <img
    src={produto.imagem}
    alt={produto.nome}
    className="h-16 w-16 rounded-lg border object-contain bg-white p-1"
  />

  <div>
    <h3 className="font-bold">
      {produto.nome}
    </h3>

    <p className="text-sm text-slate-500">
      {produto.loja}
    </p>

    <p className="mt-1 text-lg font-bold text-green-700">
      {produto.precoAtual}
    </p>
    <div className="mt-2 flex gap-2">

  {produto.destaque && (
    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-700">
      ⭐ Destaque
    </span>
  )}

  <span
    className={`rounded-full px-2 py-1 text-xs font-bold ${
      produto.ativo
        ? "bg-green-100 text-green-700"
        : "bg-slate-200 text-slate-600"
    }`}
  >
    {produto.ativo ? "🟢 Ativo" : "⚪ Inativo"}
  </span>

</div>
  </div>

</div>

        <div className="flex gap-3">

         <button
  type="button"
  onClick={() => editarProduto(produto)}
  className="rounded-lg bg-yellow-400 px-3 py-2 font-bold"
>
  ✏️
</button>

          <button
  type="button"
  onClick={() => excluirProduto(produto.id)}
  className="rounded-lg bg-red-500 px-3 py-2 text-white"
>
  🗑️
</button>

        </div>

      </div>

    ))

  )}
   
    <div className="mt-6 flex items-center justify-center gap-2">

      <button
        disabled={paginaAtual === 1}
        onClick={() => setPaginaAtual(paginaAtual - 1)}
        className="rounded-lg border px-4 py-2 disabled:opacity-40"
      >
        ← Anterior
      </button>

      {Array.from({ length: totalPaginas }, (_, i) => (
        <button
          key={i}
          onClick={() => setPaginaAtual(i + 1)}
          className={`rounded-lg px-4 py-2 ${
            paginaAtual === i + 1
              ? "bg-pink-500 text-white"
              : "border"
          }`}
        >
          {i + 1}
        </button>
      ))}

      <button
        disabled={paginaAtual === totalPaginas}
        onClick={() => setPaginaAtual(paginaAtual + 1)}
        className="rounded-lg border px-4 py-2 disabled:opacity-40"
      >
        Próxima →
      </button>

    </div>

</div>

        </section>
      </div>
      {abrirFormulario && (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-8">
    <div className="mx-auto w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black">
  {editandoId ? "🟡 Editando Produto" : "🟢 Novo Produto"}
</h2>

        <button
          type="button"
          onClick={() => setAbrirFormulario(false)}
          className="text-3xl font-black"
        >
          ×
        </button>
      </div>

      <form className="mt-8 grid gap-5">

  <input
  placeholder="Nome do produto"
  value={formulario.nome}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      nome: e.target.value,
    })
  }
  className="rounded-xl border p-4"
/>

  <select
  value={formulario.categoria}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      categoria: e.target.value,
    })
  }
  className="rounded-xl border p-4"
>
  <option value="">Selecione uma categoria</option>
<option value="Tecnologia">Tecnologia</option>
<option value="Casa e Cozinha">Casa e Cozinha</option>
<option value="Automotivo">Automotivo</option>
<option value="Esportes">Esportes</option>
<option value="Saúde e Bem-estar">Saúde e Bem-estar</option>
<option value="Alimentos e Bebidas">Alimentos e Bebidas</option>
<option value="Ferramentas">Ferramentas</option>
<option value="Moda">Moda</option>
<option value="Infantil">Infantil</option>
<option value="Pet">Pet</option>
</select>

 <select
  value={formulario.loja}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      loja: e.target.value,
    })
  }
  className="rounded-xl border p-4"
>
  <option value="Mercado Livre">Mercado Livre</option>
  <option value="Amazon">Amazon</option>
  <option value="Shopee">Shopee</option>
  <option value="Magalu">Magalu</option>
  <option value="Renner">Renner</option>
  <option value="C&A">C&A</option>
  <option value="Calvin Klein">Calvin Klein</option>
  <option value="Stanley">Stanley</option>
  <option value="Decolar">Decolar</option>
</select>
{(imagem || formulario.imagem) && (
  <div className="mb-4 flex justify-center">
    <img
      src={
        imagem
          ? URL.createObjectURL(imagem)
          : formulario.imagem
      }
      alt="Preview"
      className="h-48 w-48 rounded-2xl border bg-white object-contain p-2 shadow"
    />
  </div>
  )}
  {imagensGaleria.length > 0 && (
  <div className="mb-6">
    <p className="mb-2 font-semibold">
      Imagens encontradas no anúncio
    </p>

    <div className="grid grid-cols-5 gap-3">
      {imagensGaleria.map((url, index) => (
        <img
          key={index}
          src={url}
          alt={`Imagem ${index + 1}`}
          className="h-24 w-24 rounded-xl border bg-white object-contain p-2"
        />
      ))}
    </div>
  </div>
)}

<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    if (e.target.files?.[0]) {
      setImagem(e.target.files[0]);
    }
  }}
  className="rounded-xl border p-4"
/><div className="mt-5">
  <label className="mb-2 block font-medium">
    📸 Imagens adicionais
  </label>

  <input
    type="file"
    multiple
    accept="image/*"
    onChange={(e) =>
      setImagensExtras(
        Array.from(e.target.files || [])
      )
    }
    className="w-full rounded-xl border p-3"
  />

  {imagensExtras.length > 0 && (
    <p className="mt-2 text-sm text-slate-600">
      {imagensExtras.length} imagem(ns) selecionada(s)
    </p>
  )}
</div>
  <div className="grid grid-cols-2 gap-4">
    <input
  type="number"
  step="0.01"
  placeholder="Preço antigo"
  value={formulario.precoAntigo}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      precoAntigo: e.target.value,
    })
  }
  className="rounded-xl border p-4"
/>

    <input
  type="number"
  step="0.01"
  placeholder="Preço atual"
  value={formulario.precoAtual}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      precoAtual: e.target.value,
    })
  }
  className="rounded-xl border p-4"
/>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
  <input
    placeholder="Parcelamento"
    value={formulario.parcelas}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        parcelas: e.target.value,
      })
    }
    className="rounded-xl border p-4"
  />

  <label className="flex items-center gap-3 rounded-xl border p-4">
    <input
      type="checkbox"
      checked={formulario.freteGratis}
      onChange={(e) =>
        setFormulario({
          ...formulario,
          freteGratis: e.target.checked,
        })
      }
    />
    Frete grátis
  </label>

  <input
    type="number"
    step="0.1"
    placeholder="Avaliação"
    value={formulario.avaliacao}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        avaliacao: e.target.value,
      })
    }
    className="rounded-xl border p-4"
  />

  <input
    placeholder="Vendas"
    value={formulario.vendas}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        vendas: e.target.value,
      })
    }
    className="rounded-xl border p-4"
  />
</div>
<input
  placeholder="Link de afiliado"
  value={formulario.linkAfiliado}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      linkAfiliado: e.target.value,
    })
  }
  className="rounded-xl border p-4"
/>

{modoCadastro === "ia" && (
  <>
    <input
      placeholder="Link direto do produto"
      value={linkProdutoDireto}
      onChange={(e) => setLinkProdutoDireto(e.target.value)}
      className="rounded-xl border p-4"
    />

    <button
      type="button"
      onClick={prepararProdutoComIa}
      disabled={preparandoProduto}
      className="rounded-xl bg-violet-600 p-4 font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {preparandoProduto
        ? "Preparando produto..."
        : "✨ Preparar Produto com IA"}
    </button>
  </>
)}

  <input
  placeholder="Cupom"
  value={formulario.cupom}
  onChange={(e) =>
    setFormulario({
      ...formulario,
      cupom: e.target.value,
    })
  }
  className="rounded-xl border p-4"
/>
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="destaque"
    checked={formulario.destaque}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        destaque: e.target.checked,
      })
    }
    className="h-5 w-5"
  />

  <label htmlFor="destaque" className="font-medium">
    ⭐ Produto em destaque
  </label>
</div>
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="temEmCasa"
    checked={formulario.temEmCasa}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        temEmCasa: e.target.checked,
      })
    }
    className="h-5 w-5"
  />

  <label
    htmlFor="temEmCasa"
    className="font-medium text-pink-600"
  >
    ❤️ O Casal tem este produto em casa
  </label>
  <div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="reviewCompleta"
    checked={formulario.reviewCompleta}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        reviewCompleta: e.target.checked,
      })
    }
    className="h-5 w-5"
  />

  <label
    htmlFor="reviewCompleta"
    className="font-medium text-yellow-700"
  >
    🏆 Review completa — liberar análise
  </label>
</div>
</div>
<div className="mt-5">
  <label className="mb-2 block font-medium">
    🎥 Vídeo da análise (YouTube)
  </label>

  <input
    type="text"
    placeholder="https://youtube.com/watch?v=..."
    value={formulario.videoUrl}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        videoUrl: e.target.value,
      })
    }
    className="w-full rounded-xl border p-3"
  />
</div>
{formulario.temEmCasa && (
  <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 mt-4">
    <h3 className="text-lg font-black text-pink-700">
      ❤️ O Casal Recomenda
    </h3>

    <p className="mt-1 text-sm text-slate-600">
      Preencha apenas com a experiência real de vocês.
    </p>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <input
        type="number"
        min="0"
        max="10"
        step="0.1"
        placeholder="Nota do casal"
        value={formulario.notaCasal}
        onChange={(e) =>
          setFormulario({
            ...formulario,
            notaCasal: e.target.value,
          })
        }
        className="rounded-xl border border-slate-300 bg-white p-4"
      />

      <input
        type="text"
        placeholder="Tempo de uso (Ex: 8 meses)"
        value={formulario.tempoDeUso}
        onChange={(e) =>
          setFormulario({
            ...formulario,
            tempoDeUso: e.target.value,
          })
        }
        className="rounded-xl border border-slate-300 bg-white p-4"
      />
    </div>

    <textarea
      rows={4}
      placeholder="Opinião do casal"
      value={formulario.opiniaoCasal}
      onChange={(e) =>
        setFormulario({
          ...formulario,
          opiniaoCasal: e.target.value,
        })
      }
      className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4"
    />

    <textarea
      rows={3}
      placeholder="Pontos positivos (um por linha)"
      value={formulario.pontosPositivos}
      onChange={(e) =>
        setFormulario({
          ...formulario,
          pontosPositivos: e.target.value,
        })
      }
      className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4"
    />

    <textarea
      rows={3}
      placeholder="Pontos negativos (um por linha)"
      value={formulario.pontosNegativos}
      onChange={(e) =>
        setFormulario({
          ...formulario,
          pontosNegativos: e.target.value,
        })
      }
      className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4"
    />
  </div>
)}
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    id="ativo"
    checked={formulario.ativo}
    onChange={(e) =>
      setFormulario({
        ...formulario,
        ativo: e.target.checked,
      })
    }
    className="h-5 w-5"
  />

  <label htmlFor="ativo" className="font-medium">
    Produto ativo
  </label>
</div>
  <button
  type="button"
   onClick={salvarProduto}
    className="rounded-xl bg-pink-500 p-4 font-black text-white hover:bg-pink-600"
>
    {editandoId ? "💾 Salvar Alterações" : "➕ Cadastrar Produto"}
    </button>

</form>
    </div>
  </div>
)}

<CadastroModal
  aberto={abrirModalCadastro}
  aoFechar={() => setAbrirModalCadastro(false)}
  aoEscolherIa={() => {
    limparFormularioProduto();
    setModoCadastro("ia");
    setAbrirModalCadastro(false);
    setAbrirFormulario(true);
  }}
  aoEscolherManual={() => {
    limparFormularioProduto();
    setModoCadastro("manual");
    setAbrirModalCadastro(false);
    setAbrirFormulario(true);
  }}
/>

</main>
);
}