-- option_tracked_picks was created as a genuinely shared table -- no user_id
-- column, and an RLS policy of `using (true) with check (true)` for any
-- authenticated user. That means every signed-in user could see, edit, and
-- delete every OTHER user's tracked option positions (entry price, strike,
-- notes, and now target/stop alert thresholds). This was fine when there
-- was a single real user; it stopped being fine the moment other real
-- accounts started signing up. Fixing it to match the same per-user
-- isolation the `portfolio` table (stocks) already correctly has.
alter table public.option_tracked_picks
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Every existing row predates any per-user attribution and is consistently
-- tagged "Portfolio A" across a date range matching this account's own
-- testing of the feature -- attributing it to that account rather than
-- leaving it ownerless (which would just delete everyone's access to it).
update public.option_tracked_picks
set user_id = (select id from auth.users where email = 'dsaunchez26@gmail.com')
where user_id is null;

alter table public.option_tracked_picks alter column user_id set not null;

drop policy if exists "authenticated users manage tracked picks" on public.option_tracked_picks;

create policy "users manage their own tracked picks"
  on public.option_tracked_picks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
