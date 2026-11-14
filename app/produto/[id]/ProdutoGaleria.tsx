"use client";

import { useState } from "react";

type ImagemExtra = {
  id: number | string;
  url: string;
};

export default function ProdutoGaleria({
  nome,
  imagemPrincipal,
  imagensExtras,
}: {
  nome: string;
  imagemPrincipal: string;
  imagensExtras: ImagemExtra[];
}) {
  const [imagemSelecionada, setImagemSelecionada] = useState(imagemPrincipal);

  return (
    <div>
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <img
          src={imagemSelecionada || imagemPrincipal}
          alt={nome}
          className="mx-auto h-[420px] w-full object-contain"
        />
      </div>

      {imagensExtras.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setImagemSelecionada(imagemPrincipal)}
            className={`h-20 w-20 overflow-hidden rounded-xl border-2 bg-white p-2 transition ${
              imagemSelecionada === imagemPrincipal ? "border-blue-950" : "border-slate-200"
            }`}
            aria-label="Ver imagem principal"
          >
            <img
              src={imagemPrincipal}
              alt={`${nome} - imagem principal`}
              className="h-full w-full object-contain"
            />
          </button>

          {imagensExtras.map((imagemExtra) => (
            <button
              key={imagemExtra.id}
              type="button"
              onClick={() => setImagemSelecionada(imagemExtra.url)}
              className={`h-20 w-20 overflow-hidden rounded-xl border-2 bg-white p-2 transition ${
                imagemSelecionada === imagemExtra.url ? "border-blue-950" : "border-slate-200"
              }`}
              aria-label={`Ver outra imagem de ${nome}`}
            >
              <img
                src={imagemExtra.url}
                alt={`${nome} - imagem adicional`}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
