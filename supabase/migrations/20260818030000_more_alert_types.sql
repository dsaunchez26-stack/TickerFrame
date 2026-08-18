alter table public.user_notification_settings
  add column if not exists alerts_big_move boolean not null default true,
  add column if not exists alerts_pattern boolean not null default true,
  add column if not exists alerts_earnings boolean not null default true;
