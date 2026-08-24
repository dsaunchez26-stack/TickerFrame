-- Per-sample volume, for a volume subplot under the price chart -- previously
-- only stock_cache's single latest-snapshot volume existed, no history.
alter table public.stock_price_history
  add column if not exists volume numeric;

-- One row per symbol per trading day, upserted throughout the day so it
-- settles on approximately the closing price once the day's cron runs
-- stop. Finnhub's free tier doesn't include historical daily candles, so
-- there's no way to backfill this retroactively -- longer-horizon chart
-- views (1M/3M/1Y) only become real as this accumulates starting today,
-- and the frontend hides/disables those views until there's enough of it
-- to be meaningful rather than showing a fabricated or misleadingly thin
-- chart.
create table if not exists public.daily_closes (
  symbol text not null,
  trade_date date not null,
  close_price numeric not null,
  volume numeric,
  updated_at timestamptz not null default now(),
  primary key (symbol, trade_date)
);

create index if not exists daily_closes_symbol_date_idx on public.daily_closes (symbol, trade_date desc);

alter table public.daily_closes enable row level security;

create policy "daily_closes is readable by anyone"
  on public.daily_closes for select
  using (true);

-- Keep this bounded to roughly a year -- the longest view the frontend
-- will ever offer.
select cron.schedule(
  'daily-closes-prune-daily',
  '40 11 * * *',
  $$ delete from public.daily_closes where trade_date < now() - interval '400 days'; $$
);
