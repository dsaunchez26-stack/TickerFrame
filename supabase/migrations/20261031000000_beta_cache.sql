-- Beta (sensitivity to the S&P 500) per ticker, computed from a year of daily
-- candles by the stock-betas edge function and reused for a day, plus a tiny
-- key/value table for market inputs (the risk-free rate). Both are written and
-- read only by that function (service role); RLS on with no policies.
create table if not exists public.beta_cache (
  symbol text primary key,
  beta numeric not null,
  r_squared numeric,
  volatility numeric,
  observations integer,
  computed_at timestamptz not null default now()
);
alter table public.beta_cache enable row level security;

create table if not exists public.risk_inputs (
  key text primary key,
  value numeric not null,
  as_of date,
  updated_at timestamptz not null default now()
);
alter table public.risk_inputs enable row level security;

select cron.schedule(
  'beta-cache-prune-weekly',
  '55 11 * * 0',
  $$ delete from public.beta_cache where computed_at < now() - interval '14 days'; $$
);
