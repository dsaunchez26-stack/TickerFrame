-- Raw social-attention data only: how many times each tracked ticker was
-- mentioned in recent r/wallstreetbets posts. Deliberately no sentiment
-- score, bullish/bearish lean, or ranking beyond a plain mention count --
-- this is "what's getting talked about," not a signal to act on.
create table if not exists public.wsb_mentions (
  ticker text primary key,
  name text not null,
  mention_count int not null default 0,
  sample_titles jsonb,
  scanned_at timestamptz not null default now()
);

alter table public.wsb_mentions enable row level security;

create policy "wsb_mentions is readable by anyone"
  on public.wsb_mentions for select
  using (true);
