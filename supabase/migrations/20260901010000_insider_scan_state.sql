-- Tracks the last time each tracked ticker was actually scanned by
-- insider-scanner, independent of whether it produced any insider_activity
-- rows (a ticker with zero recent Form 4 filings still needs to be "seen"
-- so stalest-first batching doesn't retry it forever while starving
-- everyone else). Service-role only -- no user-facing RLS needed.
create table if not exists public.insider_scan_state (
  ticker text primary key,
  last_scanned_at timestamptz not null default now()
);
