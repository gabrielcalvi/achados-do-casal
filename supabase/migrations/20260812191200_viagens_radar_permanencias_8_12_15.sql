begin;

update public.viagens_radares
set
  permanencia_minima_dias = 8,
  permanencia_maxima_dias = 15
where slug in (
  'poa-orlando',
  'poa-new-york',
  'poa-miami',
  'poa-los-angeles',
  'poa-lisboa',

  'gru-orlando',
  'gru-new-york',
  'gru-miami',
  'gru-los-angeles',
  'gru-lisboa',

  'gig-orlando',
  'gig-new-york',
  'gig-miami',
  'gig-los-angeles',
  'gig-lisboa'
);

select
  slug,
  origem_codigo,
  destino_codigo,
  permanencia_minima_dias,
  permanencia_maxima_dias
from public.viagens_radares
where slug in (
  'poa-orlando',
  'poa-new-york',
  'poa-miami',
  'poa-los-angeles',
  'poa-lisboa',

  'gru-orlando',
  'gru-new-york',
  'gru-miami',
  'gru-los-angeles',
  'gru-lisboa',

  'gig-orlando',
  'gig-new-york',
  'gig-miami',
  'gig-los-angeles',
  'gig-lisboa'
)
order by
  origem_codigo,
  slug;

commit;