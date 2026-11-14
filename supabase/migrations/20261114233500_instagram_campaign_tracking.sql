create table if not exists public.economize_campanha_visitas (
  id bigint generated always as identity primary key,
  codigo text not null,
  source text not null,
  medium text not null,
  campaign text not null,
  content text not null,
  landing_path text not null,
  session_id text not null,
  referer text,
  user_agent text,
  ip_hash text,
  trafego_tipo text not null default 'nao_classificado',
  trafego_motivo text,
  visitado_em timestamptz not null default now(),
  constraint economize_campanha_visitas_trafego_tipo_check
    check (trafego_tipo in ('humano_provavel', 'bot', 'interno', 'nao_classificado')),
  constraint economize_campanha_visitas_codigo_length_check
    check (char_length(codigo) between 1 and 80),
  constraint economize_campanha_visitas_campaign_length_check
    check (char_length(campaign) between 1 and 120),
  constraint economize_campanha_visitas_content_length_check
    check (char_length(content) between 1 and 120)
);

alter table public.economize_campanha_visitas enable row level security;
revoke all on table public.economize_campanha_visitas from anon, authenticated;

create index if not exists economize_campanha_visitas_campaign_content_data_idx
  on public.economize_campanha_visitas (campaign, content, visitado_em desc);

create index if not exists economize_campanha_visitas_session_data_idx
  on public.economize_campanha_visitas (session_id, visitado_em desc);

alter table public.economize_cliques
  add column if not exists campanha_visita_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'economize_cliques_campanha_visita_id_fkey'
      and conrelid = 'public.economize_cliques'::regclass
  ) then
    alter table public.economize_cliques
      add constraint economize_cliques_campanha_visita_id_fkey
      foreign key (campanha_visita_id)
      references public.economize_campanha_visitas(id)
      on delete set null;
  end if;
end
$$;

create index if not exists economize_cliques_campanha_visita_id_idx
  on public.economize_cliques (campanha_visita_id)
  where campanha_visita_id is not null;

comment on table public.economize_campanha_visitas is
  'Entradas em links rastreados de campanhas, com atribuição de origem preservada para cliques posteriores.';

comment on column public.economize_cliques.campanha_visita_id is
  'Visita de campanha que originou o clique, quando houver atribuição first-party válida.';
