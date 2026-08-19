-- Realized volatility (annualized stdev of the underlying's actual price
-- returns), computed on its own schedule rather than inline inside
-- options-scanner -- that function is invoked live/on-demand from the
-- frontend and is already latency-sensitive, so an expensive per-ticker
-- history query + stdev calc belongs in a separately-scheduled scanner that
-- options-scanner can then do one cheap batch lookup against.
create table if not exists public.realized_volatility (
  symbol text primary key,
  rv_annualized numeric,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.realized_volatility enable row level security;

create policy "realized_volatility is readable by anyone"
  on public.realized_volatility for select
  using (true);

select cron.schedule(
  'realized-volatility-scanner-every-6-hours',
  '20 */6 * * *',
  $$
    select net.http_post(
      url := 'https://xikmfhipjhabhwxtpyfn.supabase.co/functions/v1/realized-volatility-scanner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_SIJ2mxUscsis16keH6rYeA_ULXImGhs"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
