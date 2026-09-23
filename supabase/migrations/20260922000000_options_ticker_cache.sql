-- Replaces the single-row options_scan_cache blob with a per-ticker cache so
-- options-scanner can refresh a rolling batch of tickers each run (Alpaca's
-- free-tier 200 req/min cap makes a full 615-ticker live scan in one
-- invocation impossible -- see options-scanner/index.ts) instead of
-- requiring every ticker in one pass. Each row is one ticker's full computed
-- result (rows/leapsRows/creditSpreads/diagonals); the client-facing read
-- path aggregates across all rows into the same shape the UI already expects.
create table if not exists public.options_ticker_cache (
  ticker text primary key,
  payload jsonb not null,
  current_iv numeric,
  candidates integer not null default 0,
  scanned_at timestamptz not null default now()
);

create index if not exists options_ticker_cache_scanned_at_idx on public.options_ticker_cache(scanned_at);

alter table public.options_ticker_cache enable row level security;

create policy "options_ticker_cache is readable by anyone"
  on public.options_ticker_cache for select
  using (true);

-- Rolling batch scan: refreshes the stalest ~45 tickers each run (see
-- BATCH_LIMIT in options-scanner/index.ts). At that batch size the full
-- ~617-ticker universe rotates through roughly once per hour. The
-- {"mode":"scan"} body is what tells the function to run a live batch scan
-- and write to options_ticker_cache, instead of the fast read-only
-- aggregation path a client's own invoke() call takes.
select
  cron.schedule(
    'options-scanner-every-5-min',
    '*/5 * * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/options-scanner',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"mode": "scan"}'::jsonb
    );
    $$
  );
