-- Per-user daily question counter for the AI assistant, so one account can't
-- run up the model bill. Written only by the market-chat edge function
-- (service role); no policies means no client can read or write it directly.
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.assistant_usage enable row level security;
