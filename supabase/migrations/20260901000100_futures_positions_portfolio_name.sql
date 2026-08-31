-- Missed on the first pass: stocks and options both split across
-- Portfolio A / Portfolio B, futures positions should too for consistency.
alter table public.futures_positions
  add column if not exists portfolio_name text;
