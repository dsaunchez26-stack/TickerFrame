-- Short-lived cache for news headlines so repeated opens of a stock (or the
-- dashboard) don't each hit the news provider. Written and read only by the
-- stock-news edge function (service role); RLS on with no policies keeps it
-- unreachable from the browser.
create table if not exists public.news_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.news_cache enable row level security;
