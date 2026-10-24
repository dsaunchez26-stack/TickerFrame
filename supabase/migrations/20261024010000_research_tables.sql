-- Evidence tables for the quarterly signal evaluation.
--
-- backtest_results: one row per run of scripts/research/run-quarterly-evaluation.mjs,
-- shown on the Methodology page whatever it says. Public to read; only the
-- service role (the script) can write.
create table if not exists public.backtest_results (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  universe_size integer not null,
  start_date date not null,
  end_date date not null,
  factors jsonb not null,
  insider jsonb,
  fundamentals jsonb,
  notes text
);
alter table public.backtest_results enable row level security;
create policy "backtest results are public" on public.backtest_results for select using (true);
grant select on public.backtest_results to anon, authenticated;

-- fundamentals_history: a weekly copy of each stock's fundamentals scores so
-- that "do healthy, growing companies beat the rest over months?" can be
-- tested once enough weeks have piled up (we only ever stored the latest).
create table if not exists public.fundamentals_history (
  symbol text not null,
  as_of date not null,
  balance_sheet_score integer,
  growth_score integer,
  pe_ratio numeric,
  ps_ratio numeric,
  pb_ratio numeric,
  dividend_yield numeric,
  revenue_growth_yoy numeric,
  eps_growth_yoy numeric,
  net_margin numeric,
  debt_to_equity numeric,
  market_cap numeric,
  price numeric,
  primary key (symbol, as_of)
);
alter table public.fundamentals_history enable row level security;
-- no policies: read and written only by the service role / SQL

insert into public.fundamentals_history
  (symbol, as_of, balance_sheet_score, growth_score, pe_ratio, ps_ratio, pb_ratio, dividend_yield, revenue_growth_yoy, eps_growth_yoy, net_margin, debt_to_equity, market_cap, price)
select symbol, current_date, balance_sheet_score, growth_score, pe_ratio, ps_ratio, pb_ratio, dividend_yield, revenue_growth_yoy, eps_growth_yoy, net_margin, debt_to_equity, market_cap, price
from public.stock_fundamentals
on conflict do nothing;

select cron.schedule(
  'fundamentals-history-weekly',
  '0 12 * * 0',
  $$ insert into public.fundamentals_history
       (symbol, as_of, balance_sheet_score, growth_score, pe_ratio, ps_ratio, pb_ratio, dividend_yield, revenue_growth_yoy, eps_growth_yoy, net_margin, debt_to_equity, market_cap, price)
     select symbol, current_date, balance_sheet_score, growth_score, pe_ratio, ps_ratio, pb_ratio, dividend_yield, revenue_growth_yoy, eps_growth_yoy, net_margin, debt_to_equity, market_cap, price
     from public.stock_fundamentals
     on conflict do nothing; $$
);
