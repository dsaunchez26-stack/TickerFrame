-- P/E and P/B alongside the existing P/S ratio -- same Finnhub basic-financials
-- call fundamentals-scanner already makes, just reading more fields from it.
alter table public.stock_fundamentals
  add column if not exists pe_ratio numeric,
  add column if not exists pb_ratio numeric;
