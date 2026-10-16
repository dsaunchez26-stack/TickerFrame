-- Short-lived cache of OHLC bars so opening a stock's chart doesn't hit the
-- market-data provider every time. Written/read only by the stock-bars edge
-- function (service role); RLS on with no policies keeps it off the browser.
create table if not exists public.bars_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.bars_cache enable row level security;
