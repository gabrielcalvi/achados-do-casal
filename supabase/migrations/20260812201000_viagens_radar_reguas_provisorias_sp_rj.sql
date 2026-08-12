begin;

with regras (
  slug,
  excelente,
  muito_bom,
  interessante,
  comum
) as (
  values

  ('gig-orlando',     2250, 2650, 2750, 3350),
  ('gig-new-york',    2650, 3100, 3450, 3750),
  ('gig-miami',       3550, 4150, 4250, 4450),
  ('gig-los-angeles', 2950, 3450, 3800, 4700),
  ('gig-lisboa',      4200, 4850, 4950, 5700),

  ('gru-orlando',     2550, 3000, 3100, 3500),
  ('gru-new-york',    3550, 4150, 4250, 4450),
  ('gru-miami',       2550, 2950, 3250, 3450),
  ('gru-los-angeles', 3450, 4000, 4300, 4600),
  ('gru-lisboa',      3550, 4100, 4350, 5200),

  ('gru-madrid',      2400, 2800, 3800, 4600)
)

update public.viagens_radares r
set
  preco_excelente_ate =
    regras.excelente,

  preco_muito_bom_ate =
    regras.muito_bom,

  preco_interessante_ate =
    regras.interessante,

  preco_comum_ate =
    regras.comum,

  criterios =
    coalesce(
      r.criterios,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'regua_provisoria',
      true,

      'metodologia',
      'calibracao_v1_10_meses',

      'amostra_inicial_meses',
      10
    )

from regras

where r.slug =
  regras.slug;

select
  slug,
  nome,
  preco_excelente_ate,
  preco_muito_bom_ate,
  preco_interessante_ate,
  preco_comum_ate,
  criterios ->> 'regua_provisoria'
    as regua_provisoria

from public.viagens_radares

where slug in (
  'gig-orlando',
  'gig-new-york',
  'gig-miami',
  'gig-los-angeles',
  'gig-lisboa',

  'gru-orlando',
  'gru-new-york',
  'gru-miami',
  'gru-los-angeles',
  'gru-lisboa',
  'gru-madrid'
)

order by
  origem_codigo,
  slug;

commit;