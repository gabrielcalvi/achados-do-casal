-- Extend the lease so a longer Mercado Livre coupon scan is not claimed twice.
alter table public.local_agent_jobs
  alter column lease_until set default (now() + interval '10 minutes');

create or replace function public.claim_local_agent_job(p_device_id uuid)
returns setof public.local_agent_jobs
language plpgsql
security invoker
set search_path = public
as $function$
begin
  update public.local_agent_jobs
  set
    status = case when attempts >= 3 then 'failed' else 'queued' end,
    claimed_by = null,
    lease_until = null,
    error = case
      when attempts >= 3 then coalesce(error, 'Agente local perdeu a tarefa após três tentativas.')
      else error
    end,
    updated_at = now(),
    finished_at = case when attempts >= 3 then now() else finished_at end
  where status = 'running'
    and lease_until is not null
    and lease_until < now();

  return query
  with proxima as (
    select id
    from public.local_agent_jobs
    where status = 'queued'
      and attempts < 3
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.local_agent_jobs as job
  set
    status = 'running',
    claimed_by = p_device_id,
    attempts = job.attempts + 1,
    started_at = coalesce(job.started_at, now()),
    lease_until = now() + interval '10 minutes',
    updated_at = now(),
    error = null
  from proxima
  where job.id = proxima.id
  returning job.*;
end;
$function$;

revoke all on function public.claim_local_agent_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_local_agent_job(uuid) to service_role;
