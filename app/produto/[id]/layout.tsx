import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

function moeda(valor: number | null) {
  if (valor === null || !Number.isFinite(Number(valor))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numero = Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    return {
      title: "Produto | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const { data: produto } = await supabaseAdmin
    .from("produtos")
    .select("id,nome,loja,imagem,preco_atual,preco_antigo,ativo,review_completa,nota_casal,tempo_de_uso")
    .eq("id", numero)
    .maybeSingle();

  if (!produto || (!produto.ativo && !produto.review_completa)) {
    return {
      title: "Produto não encontrado | Achados do Casal",
      robots: { index: false, follow: false },
    };
  }

  const preco = moeda(produto.preco_atual);
  const descricao = produto.review_completa
    ? `Review real do Achados do Casal: ${produto.nome}. ${produto.nota_casal ? `Nota ${produto.nota_casal}/10. ` : ""}${produto.tempo_de_uso ? `Tempo de uso: ${produto.tempo_de_uso}.` : ""}`
    : preco
      ? `${preco} na ${produto.loja}. Confira preço, estoque e disponibilidade no Achados do Casal.`
      : `Confira este achado na ${produto.loja}. Preço e disponibilidade podem mudar.`;

  const canonical = `https://achadosdocasal.com.br/produto/${produto.id}`;
  const imagem = produto.imagem || undefined;

  return {
    title: { absolute: produto.nome },
    description: descricao,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Achados do Casal",
      locale: "pt_BR",
      url: canonical,
      title: produto.nome,
      description: descricao,
      images: imagem ? [{ url: imagem, alt: produto.nome }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: produto.nome,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  };
}

export default function ProdutoLayout({ children }: Props) {
  return children;
}
