create table if not exists public.viagens_pacotes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'ativo', 'inativo', 'expirado')),
  titulo text not null,
  parceiro text not null default 'Decolar',
  link_afiliado text not null,
  radar_slug text,
  radar_preco_referencia numeric(12,2),
  radar_ida_referencia date,
  radar_volta_referencia date,
  origem_codigo text not null,
  destino_codigo text not null,
  destino_nome text,
  data_ida date not null,
  data_volta date not null,
  hotel_nome text not null,
  hotel_categoria text,
  regime_hospedagem text,
  noites integer not null check (noites > 0),
  adultos integer not null default 2 check (adultos >= 1),
  criancas integer not null default 0 check (criancas >= 0),
  companhia_aerea text,
  bagagem text,
  preco_total numeric(12,2) not null check (preco_total > 0),
  preco_por_pessoa numeric(12,2) check (preco_por_pessoa > 0),
  moeda text not null default 'BRL',
  imagem_url text,
  observacoes text,
  validade timestamptz,
  destaque boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viagens_pacotes_status_idx
  on public.viagens_pacotes (status);

create index if not exists viagens_pacotes_datas_idx
  on public.viagens_pacotes (data_ida, data_volta);

create index if not exists viagens_pacotes_radar_slug_idx
  on public.viagens_pacotes (radar_slug)
  where radar_slug is not null;

alter table public.viagens_pacotes enable row level security;

drop policy if exists "Pacotes ativos podem ser lidos publicamente"
  on public.viagens_pacotes;

create policy "Pacotes ativos podem ser lidos publicamente"
  on public.viagens_pacotes
  for select
  using (
    status = 'ativo'
    and (validade is null or validade > now())
  );

create or replace function public.atualizar_viagens_pacotes_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists viagens_pacotes_updated_at
  on public.viagens_pacotes;

create trigger viagens_pacotes_updated_at
before update on public.viagens_pacotes
for each row
execute function public.atualizar_viagens_pacotes_updated_at();
