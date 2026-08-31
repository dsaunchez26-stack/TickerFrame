-- Futures had no portfolio-tracking concept at all -- the Futures page is
-- read-only live quotes with nothing tying a position to an account, so
-- there was nothing for portfolio-alerts to alert on even in principle.
-- Keyed by product_code (e.g. "ES", "CL") rather than the specific expiring
-- contract symbol -- futures roll to a new front-month contract every
-- cycle, and alerts/price-checks naturally want to match against whatever
-- futures-scanner currently reports as that PRODUCT's front-month row, not
-- an exact contract symbol that will itself expire.
create table if not exists public.futures_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_code text not null,
  product_name text not null,
  contract_symbol text not null,
  entry_price numeric not null,
  quantity integer not null default 1,
  expiration date,
  notes text,
  target_gain_pct numeric,
  stop_loss_pct numeric,
  created_at timestamptz not null default now()
);

create index if not exists futures_positions_user_idx on public.futures_positions (user_id);

alter table public.futures_positions enable row level security;

create policy "users manage their own futures positions"
  on public.futures_positions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
