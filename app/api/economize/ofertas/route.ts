import {
  NextRequest,
  NextResponse,
} from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = new Set([
  "cupom",
  "cashback",
  "promocao",
  "campanha",
  "frete_gratis",
]);

const SLUG_REGEX = /^[a-z0-9-]+$/;

type RegistroGenerico = Record<string, any>;

function aplicarCupomNaOferta(
  oferta: RegistroGenerico,
  cupom: RegistroGenerico,
  transformarEmCupom = false
) {
  return {
    ...oferta,
    tipo: transformarEmCupom ? "cupom" : oferta.tipo,
    titulo: transformarEmCupom ? cupom.titulo || oferta.titulo : oferta.titulo,
    descricao: transformarEmCupom ? cupom.descricao || oferta.descricao : oferta.descricao,
    codigo: cupom.codigo || oferta.codigo || null,
    regras: transformarEmCupom ? cupom.regras || oferta.regras : oferta.regras,
    desconto_percentual: cupom.desconto_percentual ?? oferta.desconto_percentual,
    valor_desconto: cupom.valor_desconto ?? oferta.valor_desconto,
    pedido_minimo: cupom.pedido_minimo ?? oferta.pedido_minimo,
    data_inicio: transformarEmCupom ? cupom.data_inicio ?? oferta.data_inicio : oferta.data_inicio,
    validade: transformarEmCupom ? cupom.validade ?? oferta.validade : oferta.validade,
    origem: transformarEmCupom ? cupom.origem || oferta.origem : oferta.origem,
    updated_at: transformarEmCupom ? cupom.updated_at || oferta.updated_at : oferta.updated_at,
    cupom_id: cupom.id,
  };
}

function ordenarVitrinePorDesconto(ofertas: RegistroGenerico[]) {
  return [...ofertas].sort((a, b) => {
    const descontoA = Number(a.desconto_percentual) || 0;
    const descontoB = Number(b.desconto_percentual) || 0;
    if (descontoA !== descontoB) return descontoB - descontoA;

    const economiaA = Number(a.valor_desconto) || 0;
    const economiaB = Number(b.valor_desconto) || 0;
    if (economiaA !== economiaB) return economiaB - economiaA;

    return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
  });
}

export async function GET(request: NextRequest) {
  try {
    const tipo = request.nextUrl.searchParams.get("tipo");
    const loja = request.nextUrl.searchParams.get("loja");

    if (tipo && !TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json({ error: "O tipo informado não é válido." }, { status: 400 });
    }

    if (loja && !SLUG_REGEX.test(loja)) {
      return NextResponse.json({ error: "A loja informada não é válida." }, { status: 400 });
    }

    const agora = new Date().toISOString();
    let ofertasComuns: RegistroGenerico[] = [];

    if (tipo !== "cupom") {
      let consulta = supabaseAdmin
        .from("economize_ofertas")
        .select(`
          id,loja_id,tipo,titulo,descricao,codigo,categoria,regras,imagem_url,
          desconto_percentual,valor_desconto,cashback_percentual,pedido_minimo,
          preco_original,preco_oferta,data_inicio,validade,destaque,selos,origem,updated_at,
          loja:economize_lojas!inner (id,nome,slug,dominio,logo_url,ativa,ordem)
        `)
        .eq("status", "ativo")
        .eq("economize_lojas.ativa", true)
        .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
        .or(`validade.is.null,validade.gt.${agora}`)
        .order("destaque", { ascending: false })
        .order("updated_at", { ascending: false });

      if (tipo) consulta = consulta.eq("tipo", tipo);
      if (loja) consulta = consulta.eq("economize_lojas.slug", loja);

      const { data: ofertas, error: erroOfertas } = await consulta;

      if (erroOfertas) {
        console.error("Erro ao carregar ofertas públicas:", erroOfertas);
        return NextResponse.json({ error: "Não foi possível carregar as oportunidades." }, { status: 500 });
      }

      ofertasComuns = (ofertas ?? []) as RegistroGenerico[];
    }

    let consultaCupons = supabaseAdmin
      .from("economize_cupons")
      .select(`
        id,loja_id,status,codigo,titulo,descricao,regras,tipo_desconto,
        desconto_percentual,valor_desconto,pedido_minimo,data_inicio,validade,origem,updated_at,
        loja:economize_lojas!inner (id,nome,slug,dominio,logo_url,ativa,ordem)
      `)
      .eq("status", "ativo")
      .eq("economize_lojas.ativa", true)
      .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
      .or(`validade.is.null,validade.gt.${agora}`)
      .order("updated_at", { ascending: false });

    if (loja) consultaCupons = consultaCupons.eq("economize_lojas.slug", loja);

    const { data: cuponsAtivos, error: erroCupons } = await consultaCupons;

    if (erroCupons) {
      console.error("Erro ao carregar cupons públicos:", erroCupons);
      if (tipo === "cupom") {
        return NextResponse.json({ error: "Não foi possível carregar os cupons." }, { status: 500 });
      }
    }

    const cupons = (cuponsAtivos ?? []) as RegistroGenerico[];
    let ofertasComCupom = ofertasComuns;
    let ofertasDoFiltroCupom: RegistroGenerico[] = [];

    if (cupons.length > 0) {
      const idsCupons = cupons.map((cupom) => cupom.id);
      const { data: vinculos, error: erroVinculos } = await supabaseAdmin
        .from("economize_cupons_ofertas")
        .select("cupom_id, oferta_id")
        .in("cupom_id", idsCupons);

      if (erroVinculos) {
        console.error("Erro ao carregar vínculos de cupons:", erroVinculos);
        if (tipo === "cupom") {
          return NextResponse.json({ error: "Não foi possível carregar os vínculos dos cupons." }, { status: 500 });
        }
      } else if (vinculos?.length) {
        const mapaCupons = new Map<string, RegistroGenerico>();
        for (const cupom of cupons) mapaCupons.set(cupom.id, cupom);

        const mapaCupomPorOferta = new Map<string, RegistroGenerico>();
        for (const vinculo of vinculos) {
          const cupom = mapaCupons.get(vinculo.cupom_id);
          if (cupom && !mapaCupomPorOferta.has(vinculo.oferta_id)) {
            mapaCupomPorOferta.set(vinculo.oferta_id, cupom);
          }
        }

        if (ofertasComuns.length > 0) {
          ofertasComCupom = ofertasComuns.map((oferta) => {
            const cupom = mapaCupomPorOferta.get(oferta.id);
            return cupom ? aplicarCupomNaOferta(oferta, cupom, false) : oferta;
          });
        }

        if (tipo === "cupom") {
          const idsOfertas = Array.from(new Set(vinculos.map((vinculo) => vinculo.oferta_id)));
          if (idsOfertas.length > 0) {
            let consultaOfertasVinculadas = supabaseAdmin
              .from("economize_ofertas")
              .select(`
                id,loja_id,tipo,titulo,descricao,codigo,categoria,regras,imagem_url,
                desconto_percentual,valor_desconto,cashback_percentual,pedido_minimo,
                preco_original,preco_oferta,data_inicio,validade,destaque,selos,origem,updated_at,
                loja:economize_lojas!inner (id,nome,slug,dominio,logo_url,ativa,ordem)
              `)
              .in("id", idsOfertas)
              .eq("status", "ativo")
              .eq("economize_lojas.ativa", true)
              .or(`data_inicio.is.null,data_inicio.lte.${agora}`)
              .or(`validade.is.null,validade.gt.${agora}`);

            if (loja) consultaOfertasVinculadas = consultaOfertasVinculadas.eq("economize_lojas.slug", loja);

            const { data: ofertasVinculadas, error: erroOfertasVinculadas } = await consultaOfertasVinculadas;
            if (erroOfertasVinculadas) {
              console.error("Erro ao carregar ofertas vinculadas aos cupons:", erroOfertasVinculadas);
              return NextResponse.json({ error: "Não foi possível carregar as ofertas dos cupons." }, { status: 500 });
            }

            for (const oferta of ofertasVinculadas ?? []) {
              const cupom = mapaCupomPorOferta.get(oferta.id);
              if (cupom) ofertasDoFiltroCupom.push(aplicarCupomNaOferta(oferta as RegistroGenerico, cupom, true));
            }
          }
        }
      }
    }

    let ofertasFinais = tipo === "cupom" ? ofertasDoFiltroCupom : ofertasComCupom;

    if (loja) {
      ofertasFinais = ordenarVitrinePorDesconto(ofertasFinais);
    } else if (tipo === "cupom") {
      ofertasFinais.sort((a, b) => {
        const destaqueA = a.destaque ? 1 : 0;
        const destaqueB = b.destaque ? 1 : 0;
        if (destaqueA !== destaqueB) return destaqueB - destaqueA;
        return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
      });
    }

    return NextResponse.json(
      { ofertas: ofertasFinais, total: ofertasFinais.length, atualizadoEm: agora },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Erro inesperado na Central Economize pública:", error);
    return NextResponse.json({ error: "Erro interno ao carregar as oportunidades." }, { status: 500 });
  }
}
