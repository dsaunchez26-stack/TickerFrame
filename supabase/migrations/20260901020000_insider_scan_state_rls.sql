-- insider_scan_state was created without RLS -- every other internal-only
-- table in this project (cron_runs, error_logs) enables it even when it
-- only carries a service-role write policy, and this one was missed.
-- Verified live: with RLS off, the anon/publishable key could both read
-- and INSERT/overwrite any row, meaning anyone could poison a ticker's
-- last_scanned_at (e.g. set it far in the future to permanently exclude it
-- from insider-scanner's stalest-first rotation). No policies needed here
-- -- this is pure internal bookkeeping nothing in the frontend reads, and
-- the edge function's service-role client bypasses RLS entirely.
alter table public.insider_scan_state enable row level security;
