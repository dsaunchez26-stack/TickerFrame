-- Ties tracked option picks to a specific portfolio (Portfolio A/B/etc.) and
-- records contract quantity, so a pick can show up as a real position with a
-- real total cost rather than an implied single contract.
alter table public.option_tracked_picks
  add column if not exists portfolio_name text,
  add column if not exists quantity numeric not null default 1;
