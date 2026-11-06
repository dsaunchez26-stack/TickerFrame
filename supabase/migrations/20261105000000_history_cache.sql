-- Long-run price history (5 to 60+ years) for the stock chart's 5Y / 10Y / 20Y / MAX views.
-- One row per symbol ("AAPL:all"); the payload holds both series: the last 10 years as
-- weekly closes and the full history as month-end closes. Written and read only by the
-- stock-history edge function (service role); RLS on with no policies keeps it
-- unreachable from the browser. Old history barely changes, so rows live a while.
create table if not exists public.history_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.history_cache enable row level security;

select cron.schedule(
  'history-cache-prune-weekly',
  '20 11 * * 0',
  $$ delete from public.history_cache where fetched_at < now() - interval '30 days'; $$
);
