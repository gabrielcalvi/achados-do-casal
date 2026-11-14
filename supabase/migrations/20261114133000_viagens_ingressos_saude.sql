-- Adiciona monitoramento de disponibilidade aos ingressos/atrações
-- para que o painel de Saúde das ofertas de viagem seja unificado.

alter table public.viagens_ingressos
  add column if not exists disponibilidade_status text not null default 'nao_verificado',
  add column if not exists disponibilidade_falhas integer not null default 0,
  add column if not exists disponibilidade_verificada_em timestamptz,
  add column if not exists disponibilidade_motivo text,
  add column if not exists disponibilidade_ultima_ok_em timestamptz;
