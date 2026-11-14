-- Amplia a mesma tabela de ofertas de viagem sem quebrar os pacotes existentes.
-- Pacotes continuam sendo o tipo padrao e preservam URLs/dados atuais.

alter table public.viagens_pacotes
  drop constraint if exists viagens_pacotes_tipo_check;

alter table public.viagens_pacotes
  add constraint viagens_pacotes_tipo_check
  check (
    tipo = any (
      array[
        'pacote'::text,
        'hotel'::text,
        'ingresso'::text,
        'carro'::text,
        'cruzeiro'::text,
        'experiencia'::text,
        'passeio'::text,
        'outro'::text
      ]
    )
  );
