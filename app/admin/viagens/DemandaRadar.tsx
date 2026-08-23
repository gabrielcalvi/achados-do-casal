import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function nomeOrigem(codigo: string | null) {
  const mapa: Record<string, string> = {
    POA: "Porto Alegre",
    GRU: "São Paulo",
    GIG: "Rio de Janeiro",
    FLN: "Florianópolis",
    BSB: "Brasília",
    CNF: "Belo Horizonte",
    SSA: "Salvador",
    REC: "Recife",
  };
  return codigo ? mapa[codigo] || codigo : "—";
}

export default async function DemandaRadar() {
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("viagens_interacoes")
    .select("evento,origem_codigo,destino_codigo,detalhe,session_id,criado_em")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(5000);

  if (error) {
    return (
      <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black">📊 Demanda real do Radar</h2>
        <p className="mt-2 font-bold text-red-600">Não foi possível carregar as métricas: {error.message}</p>
      </section>
    );
  }

  const interacoes = data ?? [];
  const sessoes = new Set(interacoes.map((item) => item.session_id).filter(Boolean));
  const origens = new Map<string, number>();
  const destinos = new Map<string, number>();
  const outras = new Map<string, number>();
  let buscasOrcamento = 0;

  for (const item of interacoes) {
    if (item.evento === "origem_selecionada" && item.origem_codigo) {
      origens.set(item.origem_codigo, (origens.get(item.origem_codigo) || 0) + 1);
    }
    if (item.evento === "destino_selecionado" && item.destino_codigo) {
      destinos.set(item.destino_codigo, (destinos.get(item.destino_codigo) || 0) + 1);
    }
    if (item.evento === "outra_origem_interesse" && item.detalhe) {
      const chave = item.detalhe.trim();
      outras.set(chave, (outras.get(chave) || 0) + 1);
    }
    if (item.evento === "busca_orcamento") buscasOrcamento += 1;
  }

  const rankingOrigens = Array.from(origens.entries()).sort((a, b) => b[1] - a[1]);
  const rankingDestinos = Array.from(destinos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rankingOutras = Array.from(outras.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <section className="mt-6 rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Últimos 30 dias</p>
          <h2 className="mt-1 text-2xl font-black">📊 Demanda real do Radar</h2>
          <p className="mt-1 text-sm text-slate-500">Aqui vamos decidir com dados quais origens merecem monitoramento permanente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">{interacoes.length} interações</span>
          <span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">{sessoes.size} sessões</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">{buscasOrcamento} buscas de orçamento</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-black">Origens mais escolhidas</h3>
          <div className="mt-3 space-y-2">
            {rankingOrigens.length ? rankingOrigens.map(([codigo, quantidade]) => (
              <div key={codigo} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold">{nomeOrigem(codigo)}</span><strong>{quantidade}</strong>
              </div>
            )) : <p className="text-sm text-slate-500">Aguardando as primeiras interações.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-black">Destinos mais filtrados</h3>
          <div className="mt-3 space-y-2">
            {rankingDestinos.length ? rankingDestinos.map(([codigo, quantidade]) => (
              <div key={codigo} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-bold">{codigo}</span><strong>{quantidade}</strong>
              </div>
            )) : <p className="text-sm text-slate-500">Aguardando os primeiros filtros.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="font-black text-amber-950">Cidades pedidas fora do Radar</h3>
          <div className="mt-3 space-y-2">
            {rankingOutras.length ? rankingOutras.map(([cidade, quantidade]) => (
              <div key={cidade} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span className="font-bold">{cidade}</span><strong>{quantidade}</strong>
              </div>
            )) : <p className="text-sm text-amber-800">Nenhuma solicitação ainda.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
