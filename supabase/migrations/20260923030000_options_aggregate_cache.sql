-- The client-facing "aggregate read" path (options-scanner invoked without
-- {"mode":"scan"}) was re-reading and re-aggregating every single cached
-- ticker's full contract payload on every page load -- confirmed live on
-- production: with ~614 tickers cached, that request took ~8.9s and
-- occasionally exceeded the client's timeout ("Edge Function returned a
-- non-2xx status code"), and it can only get slower as the cache fills
-- further. This table lets the expensive aggregation happen once, at the
-- end of each 5-minute scan batch, instead of on every client request --
-- the read path becomes a single-row lookup.
create table if not exists public.options_aggregate_cache (
  id boolean primary key default true,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint options_aggregate_cache_singleton check (id)
);

alter table public.options_aggregate_cache enable row level security;

create policy "options_aggregate_cache is readable by anyone"
  on public.options_aggregate_cache for select
  using (true);
