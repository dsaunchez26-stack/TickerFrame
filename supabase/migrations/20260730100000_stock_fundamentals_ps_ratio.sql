-- Price-to-sales ratio and market cap, for a "cheap relative to revenue"
-- value screen distinct from the existing balance-sheet/growth screen.
-- market_cap is in millions of dollars (matches Finnhub's own units).
alter table public.stock_fundamentals
  add column if not exists ps_ratio numeric,
  add column if not exists market_cap numeric;
