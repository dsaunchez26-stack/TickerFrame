-- Caches the last successful options scan so a transient upstream failure
-- (MarketData.app's single-device lock appears to intermittently reject
-- calls from Supabase's rotating serverless egress IPs) shows the most
-- recent good data instead of a blank "no results" state.
create table if not exists public.options_scan_cache (
  id boolean primary key default true,
  payload jsonb not null,
  scanned_at timestamptz not null default now(),
  constraint options_scan_cache_singleton check (id)
);

alter table public.options_scan_cache enable row level security;

create policy "options_scan_cache is readable by anyone"
  on public.options_scan_cache for select
  using (true);
