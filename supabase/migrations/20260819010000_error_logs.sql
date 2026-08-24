-- ErrorBoundary.tsx has been calling supabase.from('error_logs').insert(...)
-- on every caught render error since it was written -- this table never
-- actually existed, so every one of those inserts has been silently
-- failing (wrapped in try/catch, "logging is best-effort") with zero
-- record anywhere that a crash even happened.
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  stack text,
  route text,
  user_agent text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

-- Any signed-in user can log their own crash (or an anonymous one with no
-- user_id) -- this is fire-and-forget diagnostic telemetry, not user data.
create policy "authenticated users can insert error logs"
  on public.error_logs for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

-- Stack traces and routes are internal diagnostic detail -- only admins
-- (same role check Health.tsx's route already gates on) should be able to
-- read them back.
create policy "admins can read error logs"
  on public.error_logs for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Pure diagnostic noise past this point -- same 30-day retention pattern
-- already used for cron_runs.
select cron.schedule(
  'error-logs-prune-daily',
  '35 11 * * *',
  $$ delete from public.error_logs where created_at < now() - interval '30 days'; $$
);
