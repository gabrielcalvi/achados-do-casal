begin;

with novas_rotas (
  slug,
  nome,
  origem_codigo,
  destino_codigo,
  base_slug
) as (
  values

  (
    'gru-orlando',
    'Sao Paulo -> Orlando',
    'GRU',
    'ORL',
    'poa-orlando'
  ),
  (
    'gru-new-york',
    'Sao Paulo -> Nova York',
    'GRU',
    'NYC',
    'poa-new-york'
  ),
  (
    'gru-miami',
    'Sao Paulo -> Miami',
    'GRU',
    'MIA',
    'poa-miami'
  ),
  (
    'gru-los-angeles',
    'Sao Paulo -> Los Angeles',
    'GRU',
    'LAX',
    'poa-los-angeles'
  ),
  (
    'gru-lisboa',
    'Sao Paulo -> Lisboa',
    'GRU',
    'LIS',
    'poa-lisboa'
  ),

  (
    'gig-orlando',
    'Rio de Janeiro -> Orlando',
    'GIG',
    'ORL',
    'poa-orlando'
  ),
  (
    'gig-new-york',
    'Rio de Janeiro -> Nova York',
    'GIG',
    'NYC',
    'poa-new-york'
  ),
  (
    'gig-miami',
    'Rio de Janeiro -> Miami',
    'GIG',
    'MIA',
    'poa-miami'
  ),
  (
    'gig-los-angeles',
    'Rio de Janeiro -> Los Angeles',
    'GIG',
    'LAX',
    'poa-los-angeles'
  ),
  (
    'gig-lisboa',
    'Rio de Janeiro -> Lisboa',
    'GIG',
    'LIS',
    'poa-lisboa'
  )
)

insert into public.viagens_radares (
  slug,
  nome,
  origem_codigo,
  destino_codigo,
  permanencia_minima_dias,
  permanencia_maxima_dias,
  preco_excelente_ate,
  preco_muito_bom_ate,
  preco_interessante_ate,
  preco_comum_ate,
  criterios
)

select
  nova.slug,
  nova.nome,
  nova.origem_codigo,
  nova.destino_codigo,

  base.permanencia_minima_dias,
  base.permanencia_maxima_dias,

  -- PROVISORIO:
  -- copiamos a regua de POA apenas para permitir
  -- a coleta tecnica inicial.
  -- Antes de publicar GRU/GIG vamos recalibrar
  -- com os precos reais de cada origem.

  base.preco_excelente_ate,
  base.preco_muito_bom_ate,
  base.preco_interessante_ate,
  base.preco_comum_ate,

  base.criterios

from novas_rotas nova

join public.viagens_radares base
  on base.slug = nova.base_slug

where not exists (
  select 1
  from public.viagens_radares existente
  where existente.slug = nova.slug
);

select
  slug,
  nome,
  origem_codigo,
  destino_codigo,
  permanencia_minima_dias,
  permanencia_maxima_dias,
  preco_excelente_ate,
  preco_muito_bom_ate,
  preco_interessante_ate,
  preco_comum_ate
from public.viagens_radares
where origem_codigo in ('GRU', 'GIG')
order by origem_codigo, slug;

commit;
