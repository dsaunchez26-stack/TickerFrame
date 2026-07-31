-- %B position within the 20-period Bollinger Bands (2 std dev): 0 = at the
-- lower band, 1 = at the upper band, >1 = trading above the upper band
-- (statistically stretched to the upside), <0 = below the lower band.
alter table public.stock_cache
  add column if not exists bollinger_pct_b numeric;
