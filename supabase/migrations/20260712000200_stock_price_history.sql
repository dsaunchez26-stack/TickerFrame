-- Our own rolling price history, since Finnhub's free tier no longer
-- includes historical candles. fetch-stock-data appends one row per
-- symbol per run and computes technicals from these samples instead.
create table if not exists public.stock_price_history (
  id bigint generated always as identity primary key,
  symbol text not null,
  price numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists stock_price_history_symbol_recorded_idx
  on public.stock_price_history (symbol, recorded_at desc);

alter table public.stock_price_history enable row level security;

create policy "stock_price_history is readable by anyone"
  on public.stock_price_history for select
  using (true);
