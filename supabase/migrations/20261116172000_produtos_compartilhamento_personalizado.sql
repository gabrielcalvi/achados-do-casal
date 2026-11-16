alter table public.produtos
  add column if not exists compartilhamento_titulo text,
  add column if not exists compartilhamento_descricao text;
