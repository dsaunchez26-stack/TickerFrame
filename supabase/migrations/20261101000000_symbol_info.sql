-- What a ticker is (company or fund name, whether it is a fund, and for stocks the
-- industry tag), looked up once per ticker and kept for a month. Used to say which
-- sector or asset class an untracked holding belongs to. Service role only.
create table if not exists public.symbol_info (
  symbol text primary key,
  name text,
  is_fund boolean not null default false,
  industry text,
  found boolean not null default true,
  fetched_at timestamptz not null default now()
);
alter table public.symbol_info enable row level security;
