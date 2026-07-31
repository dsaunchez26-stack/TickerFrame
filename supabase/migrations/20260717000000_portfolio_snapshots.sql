-- Daily portfolio value snapshots, so trend comparisons ("up/down vs N days
-- ago") and pace-based illustrations have real historical data to work from.
-- We've never recorded this before, so history only starts accumulating
-- from whenever this migration lands -- there is no way to retroactively
-- know what a portfolio "was" before we started tracking it.
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  portfolio_type text not null,
  portfolio_name text not null,
  total_value numeric not null,
  total_invested numeric not null,
  pnl_pct numeric not null,
  captured_at timestamptz not null default now()
);

create index if not exists portfolio_snapshots_lookup_idx
  on public.portfolio_snapshots (user_id, portfolio_type, portfolio_name, captured_at desc);

alter table public.portfolio_snapshots enable row level security;

create policy "users manage their own portfolio snapshots"
  on public.portfolio_snapshots for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
