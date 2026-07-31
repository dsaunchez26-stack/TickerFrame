-- Periodically refresh stock_cache via the fetch-stock-data edge function.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'fetch-stock-data-every-5-min',
    '*/5 * * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/fetch-stock-data',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
  );
