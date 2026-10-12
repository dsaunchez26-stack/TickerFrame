-- 1) Remove price samples and daily-close rows recorded while the market was
--    closed (a flat weekend of identical prices, plus a phantom Sunday row).
delete from public.stock_price_history where recorded_at >= '2026-10-11';
delete from public.daily_closes where trade_date >= '2026-10-11';

-- 2) Run the price scanner only on weekdays during US market hours, every 3
--    minutes (~30 requests/min on average, under Finnhub's 60/min), instead of
--    around the clock every 5. 13:00-21:59 UTC covers the session in both EDT
--    and EST; the function itself skips anything outside 9:30-16:05 New York
--    time. Also gives pg_net a real timeout so the function's response (and any
--    error in it) is recorded instead of a 5-second client timeout every run.
select cron.unschedule('fetch-stock-data-every-5-min');
select cron.schedule(
  'fetch-stock-data-market-hours',
  '*/3 13-21 * * 1-5',
  $$ select net.http_post(
       url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/fetch-stock-data',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 150000
     ); $$
);
