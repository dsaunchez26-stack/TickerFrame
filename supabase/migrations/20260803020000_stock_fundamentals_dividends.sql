-- Dividend yield + payout ratio, same Finnhub basic-financials call
-- fundamentals-scanner already makes. Distinct from the value/growth
-- screens -- this is for stocks bought for steady income, not price
-- appreciation, so the whole point is separate filters and a separate page.
alter table public.stock_fundamentals
  add column if not exists dividend_yield numeric,
  add column if not exists payout_ratio numeric;
