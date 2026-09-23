-- Both tables are confirmed unreferenced anywhere in the app or edge
-- functions (verified via a full-repo grep before this migration was
-- written):
--   - options_scan_cache: the old single-row options-scan blob, replaced by
--     options_ticker_cache's per-ticker rolling cache (see
--     20260922000000_options_ticker_cache.sql).
--   - signal_outcomes: dead since the EntryExit/signal-tracking widget was
--     removed in an earlier cleanup pass; nothing has written or read it
--     since.
drop table if exists public.options_scan_cache;
drop table if exists public.signal_outcomes;
