import Link from "next/link";
type Produto = {
  id: number;
  nome: string;
  loja: string;
  categoria: string;
  imagem: string;
  precoAnterior?: number;
  precoAtual: number;
  pagamento: string;
  link: string;
  selo?: string;
  avaliacao?: number;
  vendas?: string;
  parcelas?: string;
  freteGratis?: boolean;
  temEmCasa?: boolean;
  reviewCompleta?: boolean;
};

type CardProdutoProps = {
  produto: Produto;
};

function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularDesconto(precoAnterior?: number, precoAtual?: number) {
  if (!precoAnterior || !precoAtual || precoAnterior <= precoAtual) {
    return null;
  }

  return Math.round(
    ((precoAnterior - precoAtual) / precoAnterior) * 100,
  );
}

export default function CardProduto({ produto }: CardProdutoProps) {
  const desconto = calcularDesconto(
    produto.precoAnterior,
    produto.precoAtual,
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative flex h-60 items-center justify-center bg-slate-50 p-4">
        {produto.selo && (
          <span className="absolute left-4 top-4 rounded-full bg-pink-500 px-3 py-2 text-xs font-black uppercase text-white">
            {produto.selo}
          </span>
        )}

        {desconto && (
          <span className="absolute right-4 top-4 rounded-full bg-green-600 px-3 py-2 text-xs font-black text-white">
            -{desconto}%
          </span>
        )}

        <Link href={`/produto/${produto.id}`}>
  <img
    src={produto.imagem}
    alt={produto.nome}
    className="mx-auto h-full max-h-52 w-full max-w-52 object-contain cursor-pointer transition hover:scale-105"
  />
</Link>
</div>
      <div className="p-6">
        <p className="text-sm font-black uppercase text-blue-800">
          {produto.loja}
        </p>
<h3 className="mt-3 min-h-14 text-xl font-black text-slate-950">
  <Link
    href={`/produto/${produto.id}`}
    className="hover:text-pink-600 transition"
  >
    {produto.nome}
  </Link>
</h3>      

{produto.reviewCompleta ? (
  <div className="mt-2">
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
      🏆 Recomendado pelo Casal
    </span>
  </div>
) : produto.temEmCasa ? (
  <div className="mt-2">
    <span className="inline-flex items-center rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">
      ❤️ O Casal tem em casa
    </span>
  </div>
) : null}
        <p className="mt-3 text-sm text-slate-500">
          {produto.categoria}
        </p>

        {(produto.avaliacao || produto.vendas) && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-slate-700">
            {produto.avaliacao && (
              <span>⭐ {produto.avaliacao}</span>
            )}

            {produto.vendas && (
              <span>🛒 {produto.vendas}</span>
            )}
          </div>
        )}

        <div className="mt-5">
          {produto.precoAnterior && (
            <p className="text-sm text-slate-400 line-through">
              De {formatarPreco(produto.precoAnterior)}
            </p>
          )}

          <p className="text-3xl font-black text-pink-500">
            {formatarPreco(produto.precoAtual)}
          </p>
        </div>

        {produto.parcelas && (
          <p className="mt-2 text-sm font-bold text-slate-700">
            💳 {produto.parcelas}
          </p>
        )}

        {produto.freteGratis && (
          <p className="mt-2 text-sm font-bold text-green-700">
            🚚 Frete grátis
          </p>
        )}

        {produto.pagamento && (
          <p className="mt-2 text-sm font-black text-green-700">
            {produto.pagamento}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">

  {produto.reviewCompleta && (
  <Link
    href={`/produto/${produto.id}`}
    className="inline-flex w-full justify-center rounded-xl border-2 border-blue-950 bg-white px-5 py-3 font-bold text-blue-950 transition hover:bg-slate-100"
  >
    🔎 Ver análise
  </Link>
)}

  <a
    href={produto.link}
    target="_blank"
    rel="sponsored noopener noreferrer"
    className="inline-flex w-full justify-center rounded-xl bg-blue-950 px-5 py-4 font-black text-white transition hover:bg-blue-900"
  >
    🛒 Ver oferta
  </a>

</div>
      </div>
    </article>
  );
}