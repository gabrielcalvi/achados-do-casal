begin;

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
values (
  'gru-madrid',
  'Sao Paulo -> Madrid',
  'GRU',
  'MAD',

  8,
  15,

  2300,
  2800,
  2800,
  999999,

  jsonb_build_object(
    'modo',
    'calibracao',

    'motor',
    'radar_inteligente_viagens',

    'regua_provisoria',
    true,

    'publicar',
    false,

    'referencia_inicial_min',
    2300,

    'referencia_inicial_max',
    2800,

    'referencia_origem',
    'promocao observada em 2026-08-12'
  )
)

on conflict (slug)
do nothing;

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
  preco_comum_ate,
  criterios
from public.viagens_radares
where slug = 'gru-madrid';

commit;
