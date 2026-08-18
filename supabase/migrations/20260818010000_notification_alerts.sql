-- Per-user Slack alert preferences: webhook URL + which alert types to send.
-- One row per user, managed entirely by the owning user (RLS-scoped), so
-- this is safe to let every account configure independently.
create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slack_webhook_url text,
  alerts_insider boolean not null default true,
  alerts_target_stop boolean not null default true,
  alerts_value_ideas boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_settings enable row level security;

create policy "users manage their own notification settings"
  on public.user_notification_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Dedupe log for portfolio-alerts: one row per (user, alert) so the every-
-- 30-minutes cron doesn't re-post the same insider filing / target hit /
-- idea every time it runs. Service-role only (no policies), same pattern as
-- cron_runs.
create table if not exists public.sent_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  sent_at timestamptz not null default now()
);

create index if not exists sent_alerts_sent_at_idx on public.sent_alerts (sent_at desc);

alter table public.sent_alerts enable row level security;

-- Keep the dedupe log from growing forever -- alert keys are scoped to a day
-- or ISO week at most, so nothing past 45 days is ever consulted again.
select cron.schedule(
  'sent-alerts-prune-daily',
  '45 11 * * *',
  $$ delete from public.sent_alerts where sent_at < now() - interval '45 days'; $$
);
