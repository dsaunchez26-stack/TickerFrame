-- Tracks onboarding-tour state per user so it can re-show to a returning
-- user who's been away for a while, not just once-ever-per-browser. The
-- previous version used localStorage only ("seen once, forget forever"),
-- which meant a new browser/device saw it every time and a genuinely
-- inactive-then-returning user never saw it again. last_seen_at is read
-- BEFORE being updated on each app load -- the gap between that old value
-- and now is what decides whether to re-show, independent of Supabase
-- Auth's own last_sign_in_at (which already reflects the CURRENT sign-in
-- by the time client code can read it, not the previous one).
create table if not exists public.user_onboarding_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  dismissed_forever boolean not null default false,
  completed_at timestamptz
);

alter table public.user_onboarding_state enable row level security;

create policy "users manage their own onboarding state"
  on public.user_onboarding_state for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
