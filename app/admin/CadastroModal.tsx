"use client";

type CadastroModalProps = {
  aberto: boolean;
  aoFechar: () => void;
  aoEscolherIa: () => void;
  aoEscolherManual: () => void;
};

export default function CadastroModal({
  aberto,
  aoFechar,
  aoEscolherIa,
  aoEscolherManual,
}: CadastroModalProps) {
  if (!aberto) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
              Adicionar novo produto
            </h2>

            <p className="mt-2 text-slate-500">
              Escolha como deseja cadastrar este produto.
            </p>
          </div>

          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="text-3xl font-black text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={aoEscolherIa}
            className="rounded-2xl border-2 border-slate-200 p-6 text-left transition hover:border-violet-600 hover:shadow-lg"
          >
            <div className="text-4xl">✨</div>

            <h3 className="mt-4 text-xl font-black text-slate-900">
              Preenchimento automático
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cole o link do Mercado Livre e deixe a IA preencher as
              informações automaticamente.
            </p>

            <span className="mt-5 inline-block rounded-xl bg-violet-600 px-4 py-3 font-black text-white">
              Usar IA
            </span>
          </button>

          <button
            type="button"
            onClick={aoEscolherManual}
            className="rounded-2xl border-2 border-slate-200 p-6 text-left transition hover:border-green-600 hover:shadow-lg"
          >
            <div className="text-4xl">✍️</div>

            <h3 className="mt-4 text-xl font-black text-slate-900">
              Cadastro manual
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Preencha o produto pelo celular, notebook ou qualquer outro
              computador.
            </p>

            <span className="mt-5 inline-block rounded-xl bg-green-600 px-4 py-3 font-black text-white">
              Cadastrar manualmente
            </span>
          </button>
        </div>

        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}