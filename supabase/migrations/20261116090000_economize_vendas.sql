create table if not exists public.economize_vendas (
  id bigint generated always as identity primary key,
  data_venda date not null,
  status text not null default 'confirmada',
  origem text not null default 'site',
  loja text,
  produto text,
  programa_afiliado text,
  valor_venda numeric(12,2),
  comissao numeric(12,2),
  moeda text not null default 'BRL',
  fonte text not null default 'manual',
  external_id text,
  produto_id bigint references public.produtos(id) on delete set null,
  oferta_id uuid references public.economize_ofertas(id) on delete set null,
  campanha_visita_id bigint references public.economize_campanha_visitas(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint economize_vendas_status_check
    check (status in ('confirmada','pendente','cancelada')),
  constraint economize_vendas_valor_check
    check (valor_venda is null or valor_venda >= 0),
  constraint economize_vendas_comissao_check
    check (comissao is null or comissao >= 0),
  constraint economize_vendas_moeda_check
    check (char_length(moeda) between 3 and 8),
  constraint economize_vendas_origem_check
    check (char_length(origem) between 1 and 120),
  constraint economize_vendas_fonte_check
    check (char_length(fonte) between 1 and 120)
);

alter table public.economize_vendas enable row level security;

revoke all on table public.economize_vendas from anon, authenticated;
grant select, insert, update, delete on table public.economize_vendas to service_role;
grant usage, select on sequence public.economize_vendas_id_seq to service_role;

create index if not exists economize_vendas_data_status_idx
  on public.economize_vendas (data_venda desc, status);
create index if not exists economize_vendas_origem_data_idx
  on public.economize_vendas (origem, data_venda desc);
create index if not exists economize_vendas_loja_data_idx
  on public.economize_vendas (loja, data_venda desc);
create index if not exists economize_vendas_produto_id_idx
  on public.economize_vendas (produto_id)
  where produto_id is not null;
create index if not exists economize_vendas_oferta_id_idx
  on public.economize_vendas (oferta_id)
  where oferta_id is not null;
create index if not exists economize_vendas_campanha_visita_id_idx
  on public.economize_vendas (campanha_visita_id)
  where campanha_visita_id is not null;
create unique index if not exists economize_vendas_fonte_external_id_uidx
  on public.economize_vendas (fonte, external_id)
  where external_id is not null;

comment on table public.economize_vendas is
  'Resultados comerciais e conversoes afiliadas do Achados do Casal, registradas manualmente ou importadas de parceiros.';
comment on column public.economize_vendas.campanha_visita_id is
  'Visita de campanha atribuida a venda quando o parceiro fornece informacao suficiente para reconciliacao.';
