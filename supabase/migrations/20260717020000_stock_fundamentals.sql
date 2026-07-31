-- Cached fundamentals snapshot per symbol (balance sheet health + growth +
-- earnings surprise history), refreshed a few times a day by the
-- fundamentals-scanner edge function. Fundamentals move far slower than
-- price, so unlike stock_cache this doesn't need a 5-minute refresh cycle.
create table if not exists public.stock_fundamentals (
  symbol text primary key,
  name text not null,
  price numeric not null,
  week52_low numeric,
  week52_high numeric,
  debt_to_equity numeric,
  current_ratio numeric,
  net_margin numeric,
  revenue_growth_yoy numeric,
  eps_growth_yoy numeric,
  avg_eps_surprise_pct numeric,
  analyst_buy_pct numeric,
  balance_sheet_score numeric not null,
  growth_score numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.stock_fundamentals enable row level security;

create policy "stock_fundamentals is readable by anyone"
  on public.stock_fundamentals for select
  using (true);
