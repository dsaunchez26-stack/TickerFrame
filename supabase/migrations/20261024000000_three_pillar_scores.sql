-- Re-score every stock under the three-pillar rule right away, from the inputs
-- already stored in stock_cache, so labels and scores are consistent over a
-- weekend when the price scanner is not running. (On the day this was applied
-- all 795 stocks kept the same Bullish/Neutral/Bearish label.) Stocks without
-- enough history yet (signal_score is null) are left alone.
with pts as (
  select symbol,
    sign(price - sma20)::int + sign(ema9 - sma20)::int
    + case when macd_histogram > 0 then 2 when macd_histogram < 0 then -2 else 0 end
    + (case when rsi <= 30 then 1 when rsi >= 70 then -1 else 0 end)
    + (case when bollinger_pct_b is null then 0 when bollinger_pct_b <= 0.05 then 1 when bollinger_pct_b >= 0.95 then -1 else 0 end) as p
  from public.stock_cache
  where signal_score is not null
)
update public.stock_cache s
set signal = case when pts.p >= 4 then 'buy' when pts.p <= -4 then 'sell' else 'hold' end,
    signal_score = round(pts.p / 6.0 * 100)
from pts
where s.symbol = pts.symbol;
