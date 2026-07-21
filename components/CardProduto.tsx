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
  link_afiliado?: string | null;
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

function calcularDesconto(
  precoAnterior?: number,
  precoAtual?: number,
) {
  if (
    !precoAnterior ||
    !precoAtual ||
    precoAnterior <= precoAtual
  ) {
    return null;
  }

  return Math.round(
    ((precoAnterior - precoAtual) / precoAnterior) * 100,
  );
}

export default function CardProduto({
  produto,
}: CardProdutoProps) {
  const desconto = calcularDesconto(
    produto.precoAnterior,
    produto.precoAtual,
  );

  return (
    <article
  className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
  style={{
    height: "760px",
    minHeight: "760px",
    maxHeight: "760px",
  }}
>
      {/* IMAGEM */}
      <div
        className="relative flex shrink-0 items-center justify-center bg-slate-50 p-4"
        style={{ height: "240px" }}
      >
        {produto.selo && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-pink-500 px-3 py-2 text-xs font-black uppercase text-white">
            {produto.selo}
          </span>
        )}

        {desconto && (
          <span className="absolute right-4 top-4 z-10 rounded-full bg-green-600 px-3 py-2 text-xs font-black text-white">
            -{desconto}%
          </span>
        )}

        <Link
          href={`/produto/${produto.id}`}
          className="flex h-full w-full items-center justify-center"
        >
          <img
            src={produto.imagem}
            alt={produto.nome}
            className="cursor-pointer object-contain transition hover:scale-105"
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "220px",
              maxHeight: "208px",
            }}
          />
        </Link>
      </div>

      {/* CONTEÚDO */}
      <div
        className="flex min-h-0 flex-1 flex-col p-6"
        style={{ height: "520px" }}
      >
        {/* Loja */}
        <p
          className="shrink-0 text-sm font-black uppercase text-blue-800"
          style={{ height: "20px" }}
        >
          {produto.loja}
        </p>

        {/* Título */}
        <h3
          className="mt-3 shrink-0 overflow-hidden text-xl font-black leading-7 text-slate-950"
          style={{ height: "84px" }}
        >
          <Link
            href={`/produto/${produto.id}`}
            className="transition hover:text-pink-600"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow: "hidden",
            }}
          >
            {produto.nome}
          </Link>
        </h3>

        {/* Selo do casal */}
        <div
          className="mt-2 flex shrink-0 items-start"
          style={{ height: "28px" }}
        >
          {produto.reviewCompleta ? (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
              🏆 Recomendado pelo Casal
            </span>
          ) : produto.temEmCasa ? (
            <span className="inline-flex items-center rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">
              ❤️ O Casal tem em casa
            </span>
          ) : null}
        </div>

        {/* Categoria */}
        <p
          className="mt-2 shrink-0 text-sm text-slate-500"
          style={{ height: "20px" }}
        >
          {produto.categoria}
        </p>

        {/* Avaliação e vendas */}
        <div
          className="mt-3 flex shrink-0 items-start"
          style={{ height: "24px" }}
        >
          {(produto.avaliacao || produto.vendas) && (
            <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-700">
              {produto.avaliacao && (
                <span>⭐ {produto.avaliacao}</span>
              )}

              {produto.vendas && (
                <span>🛒 {produto.vendas}</span>
              )}
            </div>
          )}
        </div>

        {/* Preços */}
        <div
          className="mt-3 shrink-0"
          style={{ height: "68px" }}
        >
          <p
            className="text-sm text-slate-400 line-through"
            style={{ height: "20px" }}
          >
            {produto.precoAnterior
              ? `De ${formatarPreco(produto.precoAnterior)}`
              : ""}
          </p>

          <p className="mt-1 text-3xl font-black text-pink-500">
            {formatarPreco(produto.precoAtual)}
          </p>
        </div>

        {/* Parcelas, frete e pagamento */}
        <div
          className="mt-2 shrink-0 overflow-hidden"
          style={{ height: "68px" }}
        >
          {produto.parcelas && (
            <p className="text-sm font-bold text-slate-700">
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
        </div>

        {/* BOTÕES FIXOS NO RODAPÉ */}
<div
  className="absolute flex flex-col gap-3"
  style={{
    left: "24px",
    right: "24px",
    bottom: "24px",
  }}
>
  {produto.reviewCompleta && (
    <Link
      href={`/produto/${produto.id}`}
      className="inline-flex w-full items-center justify-center rounded-xl border-2 border-blue-950 bg-white px-5 font-bold text-blue-950 transition hover:bg-slate-100"
      style={{ height: "50px" }}
    >
      🔎 Ver análise
    </Link>
  )}

  <a
    href={produto.link_afiliado || produto.link}
    target="_blank"
    rel="sponsored noopener noreferrer"
    className="inline-flex w-full items-center justify-center rounded-xl bg-blue-950 px-5 font-black text-white transition hover:bg-blue-900"
    style={{ height: "56px" }}
  >
    🛒 Ver oferta
  </a>
</div>
      </div>
    </article>
  );
}