-- net.http_post's default timeout_milliseconds is 5000 -- far too short for
-- fundamentals-scanner/insider-scanner/earnings-scanner, which routinely
-- take 25-140s. The edge function still completes and writes its data even
-- when pg_net gives up waiting (confirmed: stock_fundamentals kept updating
-- despite net._http_response logging a "timeout" for that same request), so
-- this wasn't blocking the actual scans -- but it does mean pg_net's own
-- response log is permanently useless for these three jobs, always showing
-- a false timeout instead of the real outcome. Bumping it so that log
-- means something.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'fundamentals-scanner-every-6-hours'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/fundamentals-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      timeout_milliseconds := 180000
    );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'insider-scanner-twice-daily'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/insider-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'earnings-scanner-daily'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/earnings-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
