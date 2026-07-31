-- Fundamentals move far slower than price -- a few times a day is plenty,
-- versus fetch-stock-data's 5-minute cadence for live quotes.
select
  cron.schedule(
    'fundamentals-scanner-every-6-hours',
    '0 */6 * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/fundamentals-scanner',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
  );
