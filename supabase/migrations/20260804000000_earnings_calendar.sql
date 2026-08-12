-- Real upcoming-earnings dates per tracked symbol, from SEC/Finnhub's
-- earnings calendar via the earnings-scanner edge function. Replaces every
-- previous "earnings" field in this app (EarningsCalendar.tsx's mock dates,
-- OptionRow.earningsInDays hardcoded to null) -- none of those were ever
-- real data, which is how a call option holding earnings before its
-- expiration went unflagged.
create table if not exists public.earnings_calendar (
  symbol text primary key,
  next_earnings_date date,
  hour text, -- 'bmo' (before open) | 'amc' (after close) | 'dmh' (during hours) | null if unknown
  updated_at timestamptz not null default now()
);

alter table public.earnings_calendar enable row level security;

create policy "earnings_calendar is readable by anyone"
  on public.earnings_calendar for select
  using (true);
