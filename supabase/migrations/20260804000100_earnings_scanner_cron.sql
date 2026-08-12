-- Earnings dates change infrequently (companies announce them weeks/months
-- ahead) -- once a day is plenty, and keeps this well clear of the shared
-- Finnhub key's rate limit alongside fetch-stock-data/fundamentals-scanner.
select
  cron.schedule(
    'earnings-scanner-daily',
    '0 11 * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/earnings-scanner',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
  );
