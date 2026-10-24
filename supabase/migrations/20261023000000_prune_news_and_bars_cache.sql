-- news_cache and bars_cache get one row per symbol (and range) that anyone
-- opens, so lookups of one-off tickers would otherwise pile up forever. Entries
-- are only useful for minutes; keep two days and drop the rest nightly.
select cron.schedule(
  'news-bars-cache-prune-daily',
  '50 11 * * *',
  $$ delete from public.news_cache where fetched_at < now() - interval '2 days';
     delete from public.bars_cache where fetched_at < now() - interval '2 days'; $$
);
