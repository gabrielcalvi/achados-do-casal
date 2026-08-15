alter table public.viagens_pacotes
  add column if not exists link_original text;

create index if not exists viagens_pacotes_link_original_idx
  on public.viagens_pacotes (link_original)
  where link_original is not null;
