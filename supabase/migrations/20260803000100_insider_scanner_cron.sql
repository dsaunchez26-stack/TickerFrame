-- Insider filings trickle in throughout the trading day and settle by the
-- next morning -- twice a day is plenty, and keeps the SEC EDGAR request
-- volume (one call per tracked ticker, plus one XML fetch per Form 4 found)
-- well within their fair-access guidelines versus polling more often.
select
  cron.schedule(
    'insider-scanner-twice-daily',
    '0 6,18 * * *',
    $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/insider-scanner',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    $$
  );
