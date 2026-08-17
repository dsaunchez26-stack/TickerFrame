-- User-set target/stop thresholds per position (stock and option). Purely
-- user-configured -- the app never picks or suggests a number, only flags
-- when a position crosses whatever the user themselves set. Null means no
-- alert is shown for that side.
alter table public.portfolio
  add column if not exists target_gain_pct numeric,
  add column if not exists stop_loss_pct numeric;

alter table public.option_tracked_picks
  add column if not exists target_gain_pct numeric,
  add column if not exists stop_loss_pct numeric;
