type ProdutoDestaque = {
  id: number;
  nome: string;
  loja: string;
  categoria: string;
  precoAnterior?: number;
  precoAtual: number;
  pagamento: string;
  link: string;
  imagem: string;
};

type HeroDestaqueProps = {
  produto: ProdutoDestaque | null;
};

function formatarPreco(preco: number) {
  return preco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularEconomia(precoAnterior?: number, precoAtual?: number) {
  if (!precoAnterior || !precoAtual || precoAnterior <= precoAtual) {
    return null;
  }

  return precoAnterior - precoAtual;
}

export default function HeroDestaque({
  produto,
}: HeroDestaqueProps) {
  if (!produto) {
    return (
      <div className="rounded-3xl bg-white p-7 text-center text-slate-500 shadow-2xl">
        Carregando oferta em destaque...
      </div>
    );
  }

  const ehAmazon = produto.loja.trim().toLowerCase() === "amazon";
  const economia = ehAmazon
    ? null
    : calcularEconomia(
        produto.precoAnterior,
        produto.precoAtual,
      );

  return (
    <div className="overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl">
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="flex min-h-56 items-center justify-center bg-slate-50 p-6">
          <img
            src={produto.imagem}
            alt={produto.nome}
            className="h-52 w-full object-contain"
          />
        </div>

        <div className="p-7">
          <span className="inline-flex rounded-full bg-pink-100 px-3 py-1 text-xs font-black uppercase text-pink-600">
            Achado em destaque
          </span>

          <h2 className="mt-5 text-2xl font-black">
            {produto.nome}
          </h2>

          <p className="mt-2 text-slate-500">
            {produto.categoria} — {produto.loja}
          </p>

          {ehAmazon ? (
            <div className="mt-5">
              <p className="text-sm font-bold text-amber-700">
                Preço e disponibilidade podem mudar na Amazon.
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                Consulte o preço atual na Amazon
              </p>
            </div>
          ) : (
            <>
              {produto.precoAnterior && (
                <div className="mt-5 text-sm text-slate-400 line-through">
                  De {formatarPreco(produto.precoAnterior)}
                </div>
              )}

              <div className="text-4xl font-black text-pink-500">
                {formatarPreco(produto.precoAtual)}
              </div>

              {economia && (
                <p className="mt-2 font-bold text-green-700">
                  Economia de {formatarPreco(economia)}
                </p>
              )}

              {produto.pagamento && (
                <p className="mt-2 font-bold text-green-700">
                  {produto.pagamento}
                </p>
              )}
            </>
          )}

          {ehAmazon && (
            <p className="mt-5 text-xs font-bold text-slate-500">
              Publicidade · link de afiliado Amazon
            </p>
          )}

          <a
            href={`/produto/${produto.id}/ir?origem=site`}
            className={`${ehAmazon ? "mt-2" : "mt-6"} inline-flex w-full justify-center rounded-xl bg-blue-950 px-5 py-4 font-black text-white transition hover:bg-blue-900`}
          >
            {ehAmazon ? "Ver na Amazon" : `Ver oferta na ${produto.loja}`}
          </a>
        </div>
      </div>
    </div>
  );
}