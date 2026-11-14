alter table public.produtos
  add column if not exists video_publicado_em timestamptz;

create or replace function public.definir_video_publicado_em()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  video_novo text := nullif(btrim(coalesce(new.video_url, '')), '');
  video_antigo text := case
    when tg_op = 'UPDATE' then nullif(btrim(coalesce(old.video_url, '')), '')
    else null
  end;
begin
  if video_novo is null then
    new.video_publicado_em := null;
  elsif tg_op = 'INSERT' then
    new.video_publicado_em := coalesce(new.video_publicado_em, now());
  elsif video_novo is distinct from video_antigo then
    new.video_publicado_em := now();
  else
    new.video_publicado_em := coalesce(
      new.video_publicado_em,
      old.video_publicado_em,
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.definir_video_publicado_em()
from public, anon, authenticated;

drop trigger if exists produtos_definir_video_publicado_em
on public.produtos;

create trigger produtos_definir_video_publicado_em
before insert or update of video_url on public.produtos
for each row
execute function public.definir_video_publicado_em();

update public.produtos
set video_publicado_em = coalesce(
  video_publicado_em,
  updated_at,
  created_at,
  now()
)
where nullif(btrim(coalesce(video_url, '')), '') is not null
  and video_publicado_em is null;
