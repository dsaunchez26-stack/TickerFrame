-- Core schema for live stock data + options scanner + supporting features.
-- Scoped to what the Stocks and Options pages need to render real data.

create table if not exists public.stock_cache (
  symbol text primary key,
  name text not null,
  price numeric not null,
  change numeric not null default 0,
  change_percent numeric not null default 0,
  volume bigint not null default 0,
  signal text not null default 'hold' check (signal in ('buy', 'sell', 'hold')),
  entry numeric not null default 0,
  exit_price numeric not null default 0,
  rsi numeric not null default 50,
  macd numeric not null default 0,
  sma20 numeric not null default 0,
  ema9 numeric not null default 0,
  prev_close numeric not null default 0,
  category text not null default 'core' check (category in ('core', 'volatile')),
  hold_duration text,
  pattern text,
  pattern_confidence numeric,
  fetched_at timestamptz not null default now()
);

create index if not exists stock_cache_category_idx on public.stock_cache (category);

alter table public.stock_cache enable row level security;

create policy "stock_cache is readable by anyone"
  on public.stock_cache for select
  using (true);

-- Alerts surfaced on the Stocks dashboard.
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  alert_type text not null,
  severity text not null default 'low' check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  recommended_action text,
  priority_filer text,
  acknowledged boolean not null default false,
  triggered_at timestamptz not null default now()
);

create index if not exists alerts_triggered_at_idx on public.alerts (triggered_at desc);

alter table public.alerts enable row level security;

create policy "alerts are readable by authenticated users"
  on public.alerts for select
  to authenticated
  using (true);

create policy "alerts can be acknowledged by authenticated users"
  on public.alerts for update
  to authenticated
  using (true)
  with check (true);

-- Signal log (entry/exit tracker) + outcomes.
create table if not exists public.signal_log (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  kind text not null check (kind in ('stock', 'option')),
  cp text check (cp in ('C', 'P')),
  entry_price numeric not null,
  stop_price numeric not null,
  target_price numeric not null,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  score numeric not null default 0,
  fired_at timestamptz not null default now()
);

create index if not exists signal_log_fired_at_idx on public.signal_log (fired_at desc);

alter table public.signal_log enable row level security;

create policy "signal_log is readable by authenticated users"
  on public.signal_log for select
  to authenticated
  using (true);

create table if not exists public.signal_outcomes (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signal_log (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'hit_target', 'hit_stop', 'expired')),
  closed_at timestamptz
);

create index if not exists signal_outcomes_signal_id_idx on public.signal_outcomes (signal_id);

alter table public.signal_outcomes enable row level security;

create policy "signal_outcomes is readable by authenticated users"
  on public.signal_outcomes for select
  to authenticated
  using (true);

-- Per-user portfolio tracking.
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  buy_price numeric not null,
  quantity numeric not null default 1,
  notes text,
  portfolio_type text not null default 'long_term' check (portfolio_type in ('day_trade', 'long_term', 'watchlist')),
  portfolio_name text not null default 'Portfolio A',
  portfolio_color text,
  bought_at timestamptz not null default now(),
  unique (user_id, symbol, portfolio_type, portfolio_name)
);

alter table public.portfolio enable row level security;

create policy "users manage their own portfolio"
  on public.portfolio for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared options-pick tracker (matches existing client code: no per-user scoping).
create table if not exists public.option_tracked_picks (
  id text primary key,
  picked_at timestamptz not null default now(),
  entry_price numeric not null,
  row jsonb not null,
  notes text
);

alter table public.option_tracked_picks enable row level security;

create policy "authenticated users manage tracked picks"
  on public.option_tracked_picks for all
  to authenticated
  using (true)
  with check (true);

-- Roles (admin gate for /health).
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'user')),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "users read their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);
