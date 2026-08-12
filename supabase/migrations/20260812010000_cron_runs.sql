-- Backs the System Health page's "Cron jobs" panel, which has been reading
-- from this table since it was built even though nothing ever created it --
-- every job showed "never" regardless of whether it actually ran. This is
-- also exactly why fundamentals-scanner/insider-scanner/earnings-scanner
-- silently failing on every scheduled invocation (missing auth header on
-- their cron jobs) went undetected for a week: there was no real signal
-- anywhere that would have surfaced it.
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  rows integer,
  notes text
);

create index if not exists cron_runs_job_name_ran_at_idx on public.cron_runs (job_name, ran_at desc);

alter table public.cron_runs enable row level security;

create policy "cron_runs is readable by anyone"
  on public.cron_runs for select
  using (true);

-- Only service-role (used by the edge functions themselves) can write --
-- no policy for insert/update/delete means those are blocked for anon/authenticated.

-- Unbounded growth isn't useful here -- nothing reads past the last 24h
-- (Health.tsx's own window) beyond the single latest row per job. Trim
-- anything older than 30 days daily so this doesn't grow forever.
select
  cron.schedule(
    'cron-runs-prune-daily',
    '30 11 * * *',
    $$ delete from public.cron_runs where ran_at < now() - interval '30 days'; $$
  );
