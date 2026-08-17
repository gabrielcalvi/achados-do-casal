-- Registra a AWIN como fonte real da Central Economize.
-- As fontes conhecidas ficam ativas; Casas Bahia fica cadastrada e inativa
-- ate o advertiser ID ser configurado com seguranca no pipeline.

insert into public.economize_lojas (
  nome,
  slug,
  dominio,
  ativa,
  ordem,
  updated_at
)
values (
  'Casas Bahia',
  'casas-bahia',
  'casasbahia.com.br',
  true,
  100,
  now()
)
on conflict (slug) do update
set
  nome = excluded.nome,
  dominio = excluded.dominio,
  ativa = true,
  updated_at = now();

with fontes(slug, advertiser_id, ativa, prioridade, monitor_only, pipeline) as (
  values
    ('kabum', '17729', true, 20, false, 'kabum-dedicado'),
    ('cea', '17648', true, 30, false, 'multiloja'),
    ('renner', '70694', true, 40, false, 'multiloja'),
    ('calvin-klein', '100553', true, 50, false, 'multiloja'),
    ('stanley', '30599', true, 60, false, 'multiloja'),
    ('decolar', '102459', true, 70, true, 'multiloja'),
    ('casas-bahia', null, false, 80, false, 'multiloja')
)
insert into public.economize_fontes (
  loja_id,
  nome,
  tipo,
  url,
  ativa,
  prioridade,
  intervalo_minutos,
  configuracao,
  updated_at
)
select
  l.id,
  'AWIN - cupons e promocoes',
  'afiliado',
  case
    when f.slug = 'casas-bahia' then null
    else 'https://www.awin.com/br'
  end,
  f.ativa,
  f.prioridade,
  360,
  jsonb_build_object(
    'provedor', 'awin',
    'advertiser_id', f.advertiser_id,
    'publisher_id_env', 'AWIN_PUBLISHER_ID',
    'pipeline', f.pipeline,
    'execucao_externa', true,
    'monitor_only', f.monitor_only,
    'exigir_link_afiliado', true,
    'status_integracao', case
      when f.advertiser_id is null then 'aguardando_advertiser_id'
      else 'configurada'
    end
  ),
  now()
from fontes f
join public.economize_lojas l
  on l.slug = f.slug
on conflict (loja_id, url) do update
set
  nome = excluded.nome,
  tipo = excluded.tipo,
  ativa = excluded.ativa,
  prioridade = excluded.prioridade,
  intervalo_minutos = excluded.intervalo_minutos,
  configuracao = excluded.configuracao,
  updated_at = now();

-- Como URL nula nao participa de UNIQUE no PostgreSQL, garante idempotencia
-- para a fonte pendente da Casas Bahia.
update public.economize_fontes f
set
  nome = 'AWIN - cupons e promocoes',
  tipo = 'afiliado',
  ativa = false,
  prioridade = 80,
  intervalo_minutos = 360,
  configuracao = jsonb_build_object(
    'provedor', 'awin',
    'advertiser_id', null,
    'publisher_id_env', 'AWIN_PUBLISHER_ID',
    'pipeline', 'multiloja',
    'execucao_externa', true,
    'monitor_only', false,
    'exigir_link_afiliado', true,
    'status_integracao', 'aguardando_advertiser_id'
  ),
  updated_at = now()
from public.economize_lojas l
where
  f.loja_id = l.id
  and l.slug = 'casas-bahia'
  and f.configuracao ->> 'provedor' = 'awin';

insert into public.economize_fontes (
  loja_id,
  nome,
  tipo,
  url,
  ativa,
  prioridade,
  intervalo_minutos,
  configuracao,
  updated_at
)
select
  l.id,
  'AWIN - cupons e promocoes',
  'afiliado',
  null,
  false,
  80,
  360,
  jsonb_build_object(
    'provedor', 'awin',
    'advertiser_id', null,
    'publisher_id_env', 'AWIN_PUBLISHER_ID',
    'pipeline', 'multiloja',
    'execucao_externa', true,
    'monitor_only', false,
    'exigir_link_afiliado', true,
    'status_integracao', 'aguardando_advertiser_id'
  ),
  now()
from public.economize_lojas l
where
  l.slug = 'casas-bahia'
  and not exists (
    select 1
    from public.economize_fontes f
    where
      f.loja_id = l.id
      and f.configuracao ->> 'provedor' = 'awin'
  );

create or replace function public.economize_marcar_fonte_awin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := now();
begin
  if coalesce(new.origem, '') like 'agente_%_awin_%' then
    update public.economize_fontes f
    set
      ultima_execucao_em = v_agora,
      proxima_execucao_em = v_agora + make_interval(mins => f.intervalo_minutos),
      updated_at = v_agora
    where
      f.loja_id = new.loja_id
      and f.configuracao ->> 'provedor' = 'awin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_economize_ofertas_marcar_fonte_awin
  on public.economize_ofertas;

create trigger trg_economize_ofertas_marcar_fonte_awin
after insert or update of origem, verificado_em, updated_at
on public.economize_ofertas
for each row
execute function public.economize_marcar_fonte_awin();

drop trigger if exists trg_economize_cupons_marcar_fonte_awin
  on public.economize_cupons;

create trigger trg_economize_cupons_marcar_fonte_awin
after insert or update of origem, verificado_em, updated_at
on public.economize_cupons
for each row
execute function public.economize_marcar_fonte_awin();
