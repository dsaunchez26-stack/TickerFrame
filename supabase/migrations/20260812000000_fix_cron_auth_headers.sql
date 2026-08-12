-- fundamentals-scanner, insider-scanner, and earnings-scanner all deploy
-- with verify_jwt = true (Supabase's default for newly-created functions),
-- but their cron jobs' net.http_post calls never included an Authorization
-- header -- every single scheduled run has been rejected with 401
-- UNAUTHORIZED_NO_AUTH_HEADER since each job was created. cron.job_run_details
-- still showed "succeeded" because that only reflects that the async
-- net.http_post call was queued, not that the HTTP request it fired
-- actually got a 2xx back. fetch-stock-data's identical header-less cron
-- happens to work because that one function was deployed with
-- verify_jwt = false; the other three were not, and had no real data source
-- beyond manual invocations since the day they were created.
--
-- The anon/publishable key is not a secret (it's already embedded in the
-- frontend bundle, protected only by RLS) -- passing it as the Bearer token
-- satisfies verify_jwt without needing a service-role key in this migration.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'fundamentals-scanner-every-6-hours'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/fundamentals-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb
    );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'insider-scanner-twice-daily'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/insider-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb
    );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'earnings-scanner-daily'),
  command := $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/earnings-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb
    );
  $$
);
