-- Backs the Market Regime bar and fixes SPY/QQQ never being scanned for
-- options (they were never in stock_cache -- see options-scanner.ts -- so
-- every batch run silently errored on them with "no spot price available").
-- Refreshed by options-scanner's existing 5-minute cron rather than its own
-- schedule, since VIX (via FRED) and SPY/QQQ change both need to be
-- recomputed together for the regime label to stay internally consistent.
create table if not exists public.market_regime_cache (
  id boolean primary key default true,
  vix numeric,
  vix_as_of text,
  spy_price numeric,
  spy_change_pct numeric,
  qqq_price numeric,
  qqq_change_pct numeric,
  trend text not null,
  label text not null,
  description text,
  updated_at timestamptz not null default now(),
  constraint market_regime_cache_singleton check (id)
);

alter table public.market_regime_cache enable row level security;

create policy "market_regime_cache is readable by anyone"
  on public.market_regime_cache for select
  using (true);
