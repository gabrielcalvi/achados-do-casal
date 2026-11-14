-- Unifica ingressos na tabela de ofertas de viagem e adiciona arquivamento reversivel.

alter table public.viagens_pacotes
  add column if not exists arquivado_em timestamptz;

create index if not exists viagens_pacotes_arquivado_em_idx
  on public.viagens_pacotes (arquivado_em);

insert into public.viagens_pacotes (
  id,status,tipo,titulo,parceiro,link_original,link_afiliado,
  local_nome,cidade_uf,data_ida,adultos,criancas,
  preco_total,preco_por_pessoa,moeda,imagem_url,observacoes,validade,destaque,
  created_by,created_at,updated_at,
  disponibilidade_status,disponibilidade_falhas,disponibilidade_verificada_em,
  disponibilidade_motivo,disponibilidade_ultima_ok_em
)
select
  i.id,i.status,'ingresso',i.titulo,i.parceiro,i.link_original,i.link_afiliado,
  i.atracao_nome,i.cidade_uf,i.data_uso,greatest(i.adultos,1),i.criancas,
  i.preco_total,i.preco_por_pessoa,i.moeda,i.imagem_url,i.observacoes,i.validade,i.destaque,
  i.created_by,i.created_at,i.updated_at,
  i.disponibilidade_status,i.disponibilidade_falhas,i.disponibilidade_verificada_em,
  i.disponibilidade_motivo,i.disponibilidade_ultima_ok_em
from public.viagens_ingressos i
where not exists (
  select 1 from public.viagens_pacotes p where p.id=i.id
);

delete from public.viagens_ingressos i
where exists (
  select 1 from public.viagens_pacotes p where p.id=i.id and p.tipo='ingresso'
);
