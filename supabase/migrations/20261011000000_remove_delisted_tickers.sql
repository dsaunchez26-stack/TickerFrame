-- These seven tickers no longer trade (acquired, taken private, merged or
-- renamed): Finnhub returns an empty quote for RE, CMA, JHG, SNV and ZI, and
-- EA and AVB last traded in August. Because they never update, they always
-- sorted as "stalest" and took a slot in every scan batch, and EA/AVB's old
-- prices sat in the lists looking live. Removed from the tracked list; this
-- clears their leftover rows. User portfolios are left untouched.
do $$
declare t text[] := array['RE','CMA','JHG','SNV','ZI','EA','AVB'];
begin
  delete from public.stock_cache where symbol = any(t);
  delete from public.stock_fundamentals where symbol = any(t);
  delete from public.realized_volatility where symbol = any(t);
  delete from public.earnings_calendar where symbol = any(t);
  delete from public.stock_price_history where symbol = any(t);
  delete from public.daily_closes where symbol = any(t);
  delete from public.signal_history where symbol = any(t);
  delete from public.options_ticker_cache where ticker = any(t);
  delete from public.option_iv_history where ticker = any(t);
  delete from public.insider_scan_state where ticker = any(t);
  delete from public.insider_activity where ticker = any(t);
  delete from public.wsb_mentions where ticker = any(t);
end $$;
