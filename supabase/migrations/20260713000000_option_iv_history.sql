-- Tracks a representative (near-the-money) IV reading per underlying on each
-- scan, so we can compute a genuine IV Rank (current IV vs. that ticker's own
-- recent range) instead of just rescaling the raw IV number.
create table if not exists public.option_iv_history (
  id bigint generated always as identity primary key,
  ticker text not null,
  iv numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists option_iv_history_ticker_recorded_idx
  on public.option_iv_history (ticker, recorded_at desc);

alter table public.option_iv_history enable row level security;

create policy "option_iv_history is readable by anyone"
  on public.option_iv_history for select
  using (true);
