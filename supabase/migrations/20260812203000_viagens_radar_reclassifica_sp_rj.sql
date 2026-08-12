begin;

with atualizadas as (
  update public.viagens_precos p

  set faixa =
    case
      when p.preco_por_pessoa <= r.preco_excelente_ate
        then 'achado_absurdo'

      when p.preco_por_pessoa <= r.preco_muito_bom_ate
        then 'preco_bom'

      when p.preco_por_pessoa <= r.preco_interessante_ate
        then 'interessante'

      when p.preco_por_pessoa <= r.preco_comum_ate
        then 'preco_comum'

      else 'nao_promocao'
    end

  from public.viagens_radares r

  where
    p.radar_id = r.id
    and p.provider = 'ignav'

    and r.slug in (
      'gru-orlando',
      'gru-new-york',
      'gru-miami',
      'gru-los-angeles',
      'gru-lisboa',
      'gru-madrid',

      'gig-orlando',
      'gig-new-york',
      'gig-miami',
      'gig-los-angeles',
      'gig-lisboa'
    )

  returning p.id
)

select
  count(*) as observacoes_reclassificadas
from atualizadas;

select
  r.slug,
  p.faixa,
  count(*) as observacoes

from public.viagens_precos p

join public.viagens_radares r
  on r.id = p.radar_id

where
  p.provider = 'ignav'

  and r.slug in (
    'gru-orlando',
    'gru-new-york',
    'gru-miami',
    'gru-los-angeles',
    'gru-lisboa',
    'gru-madrid',

    'gig-orlando',
    'gig-new-york',
    'gig-miami',
    'gig-los-angeles',
    'gig-lisboa'
  )

group by
  r.slug,
  p.faixa

order by
  r.slug,
  p.faixa;

commit;