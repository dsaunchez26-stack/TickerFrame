-- The original options-scanner cron (20260922000000_options_ticker_cache.sql)
-- copied fetch-stock-data's headerless net.http_post call, but that pattern
-- only works because fetch-stock-data specifically has verify_jwt disabled
-- on its function config -- options-scanner (like every other scanner here)
-- has verify_jwt enabled, so every 5-minute tick was silently getting back
-- 401 UNAUTHORIZED_NO_AUTH_HEADER before it ever reached the function code.
-- insider-scanner-twice-daily already carries the fix for this same issue
-- (an Authorization header using the publishable key, which is safe to
-- embed here the same way it's already embedded client-side) -- this just
-- applies that same fix to options-scanner's cron.
select cron.unschedule('options-scanner-every-5-min');

select
  cron.schedule(
    'options-scanner-every-5-min',
    '*/5 * * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/options-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      body := '{"mode": "scan"}'::jsonb,
      timeout_milliseconds := 120000
    );
    $$
  );
