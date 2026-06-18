-- Per-athlete opt-in flags for the two cron-driven emails. Default true
-- so existing athletes continue to receive reminders unless they opt out.

alter table public.athletes
  add column if not exists email_follow_up_reminders boolean not null default true,
  add column if not exists email_weekly_digest boolean not null default true;
