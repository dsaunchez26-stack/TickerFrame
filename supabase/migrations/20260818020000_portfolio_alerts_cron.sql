-- Runs every 30 minutes; the function itself no-ops (fast return, logged
-- as skipped) outside NYSE regular-session hours, so this doesn't need a
-- market-hours-aware cron expression.
select cron.schedule(
  'portfolio-alerts-every-30-min',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/portfolio-alerts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
