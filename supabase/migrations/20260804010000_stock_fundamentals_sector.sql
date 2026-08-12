-- Sector tag per symbol, needed so the value screens can score a stock's
-- valuation multiples against its own sector's peers instead of one flat
-- number applied to every industry alike (a software company and a grocery
-- retailer don't trade at the same "normal" P/S).
alter table public.stock_fundamentals
  add column if not exists sector text;
