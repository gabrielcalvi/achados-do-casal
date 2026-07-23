"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ProdutoPage() {
  const params = useParams();
  const id = params.id;

  const [produto, setProduto] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
const [imagensExtras, setImagensExtras] = useState<any[]>([]);
const [imagemSelecionada, setImagemSelecionada] = useState("");
  useEffect(() => {
    async function carregarProduto() {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setCarregando(false);
        return;
      }const { data: imagensData, error: erroImagens } = await supabase
  .from("produto_imagens")
  .select("*")
  .eq("produto_id", id)
  .order("ordem", { ascending: true });

if (erroImagens) {
  console.error(erroImagens);
}

setImagensExtras(imagensData || []);
setImagemSelecionada(data.imagem);

      setProduto(data);
      setCarregando(false);
    }

    if (id) {
      carregarProduto();
    }
  }, [id]);

  if (carregando) {
    return (
      <main className="mx-auto max-w-6xl p-10">
        <p className="text-slate-500">Carregando produto...</p>
      </main>
    );
  }

  if (!produto) {
    return (
      <main className="mx-auto max-w-6xl p-10">
        <h1 className="text-3xl font-black">Produto não encontrado</h1>
      </main>
    );
  }

 return (
  <main className="mx-auto max-w-6xl px-5 py-10">
    <Link
      href="/"
      className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm transition hover:border-blue-950 hover:text-blue-950"
    >
      ← Voltar para os produtos
    </Link>

    <div className="grid gap-10 lg:grid-cols-2">
        <div>
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <img
            src={imagemSelecionada || produto.imagem}
            alt={produto.nome}
            className="mx-auto h-[420px] w-full object-contain"
          />
        </div>
{imagensExtras.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-3">
    <button
      type="button"
      onClick={() => setImagemSelecionada(produto.imagem)}
     className={`h-20 w-20 overflow-hidden rounded-xl border-2 bg-white p-2 transition ${
  imagemSelecionada === produto.imagem
    ? "border-blue-950"
    : "border-slate-200"
}`}
    >
      <img
        src={produto.imagem}
        alt={`${produto.nome} - imagem principal`}
        className="h-full w-full object-contain"
      />
    </button>

    {imagensExtras.map((imagemExtra) => (
      <button
        key={imagemExtra.id}
        type="button"
        onClick={() => setImagemSelecionada(imagemExtra.url)}
        className={`h-20 w-20 overflow-hidden rounded-xl border-2 bg-white p-2 transition ${
  imagemSelecionada === imagemExtra.url
    ? "border-blue-950"
    : "border-slate-200"
}`}
      >
        <img
          src={imagemExtra.url}
          alt={`${produto.nome} - imagem adicional`}
          className="h-full w-full object-contain"
        />
      </button>
    ))}
  </div>
)}
</div>
        <div>
          <p className="text-sm font-black uppercase text-blue-800">
            {produto.loja}
          </p>

          <h1 className="mt-3 text-4xl font-black text-slate-950">
            {produto.nome}
          </h1>

          {produto.tem_em_casa && (
            <span className="mt-4 inline-flex rounded-full bg-pink-100 px-4 py-2 text-sm font-bold text-pink-700">
              ❤️ O Casal tem em casa
            </span>
          )}

          <div className="mt-6">
  {produto.preco_antigo &&
    Number(produto.preco_antigo) >
      Number(produto.preco_atual) && (
      <p className="text-sm text-slate-400 line-through">
        De{" "}
        {Number(produto.preco_antigo).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
      </p>
    )}

  <p className="mt-1 text-3xl font-black text-pink-600">
    {Number(produto.preco_atual).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}
  </p>

  {(produto.avaliacao || produto.vendas) && (
    <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-slate-700">
      {produto.avaliacao && (
        <span>⭐ {produto.avaliacao}</span>
      )}

      {produto.vendas && (
        <span>🛒 {produto.vendas}</span>
      )}
    </div>
  )}

  {(produto.parcelas || produto.frete_gratis) && (
    <div className="mt-4 space-y-2">
      {produto.parcelas && (
        <p className="font-bold text-slate-700">
          💳 {produto.parcelas}
        </p>
      )}

      {produto.frete_gratis && (
        <p className="font-bold text-green-700">
          🚚 Frete grátis
        </p>
      )}
    </div>
  )}
</div>
{produto.updated_at && (
  <p className="mt-3 text-sm font-semibold text-slate-500">
    ✅ Preço atualizado em{" "}
    {new Date(produto.updated_at).toLocaleDateString("pt-BR")} às{" "}
    {new Date(produto.updated_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}
  </p>
)}
          <a
            href={produto.link_afiliado || produto.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex w-full justify-center rounded-xl bg-blue-950 px-6 py-4 font-black text-white hover:bg-blue-900"
          >
            Ver oferta
          </a>
        </div>
      </div>

      {produto.tem_em_casa && (
        <section className="mt-12 rounded-3xl border border-pink-200 bg-pink-50 p-8">
          <h2 className="text-3xl font-black text-pink-700">
            ❤️ Avaliação do Casal
          </h2>
{produto.video_url && (
  <div className="mt-6">
    <h3 className="mb-4 text-xl font-bold text-black">
      🎥 Veja o produto em uso
    </h3>

    <div className="overflow-hidden rounded-2xl">
      <iframe
        className="aspect-video w-full"
        src={produto.video_url
          .replace("watch?v=", "embed/")
          .replace("youtu.be/", "www.youtube.com/embed/")
          .replace("youtube.com/shorts/", "www.youtube.com/embed/")}
        title="Vídeo da análise"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  </div>
)}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {produto.nota_casal && (
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm text-slate-500">Nota do casal</p>
                <p className="mt-1 text-3xl font-black">
                  ⭐ {produto.nota_casal}/10
                </p>
              </div>
            )}

            {produto.tempo_de_uso && (
              <div className="rounded-2xl bg-white p-5">
                <p className="text-sm text-slate-500">Tempo de uso</p>
                <p className="mt-1 text-xl font-black">
                  {produto.tempo_de_uso}
                </p>
              </div>
            )}
          </div>

          {produto.opiniao_casal && (
            <div className="mt-6 rounded-2xl bg-white p-6">
              <h3 className="text-xl font-black">Nossa opinião</h3>
              <p className="mt-3 whitespace-pre-line text-slate-700">
                {produto.opiniao_casal}
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {produto.pontos_positivos && (
              <div className="rounded-2xl bg-white p-6">
                <h3 className="text-xl font-black text-green-700">
                  👍 Pontos positivos
                </h3>

                <ul className="mt-3 space-y-2">
                  {produto.pontos_positivos
                    .split("\n")
                    .filter(Boolean)
                    .map((item: string, index: number) => (
                      <li key={index}>✅ {item}</li>
                    ))}
                </ul>
              </div>
            )}

            {produto.pontos_negativos && (
              <div className="rounded-2xl bg-white p-6">
                <h3 className="text-xl font-black text-red-700">
                  👎 Pontos negativos
                </h3>

                <ul className="mt-3 space-y-2">
                  {produto.pontos_negativos
                    .split("\n")
                    .filter(Boolean)
                    .map((item: string, index: number) => (
                      <li key={index}>⚠️ {item}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}