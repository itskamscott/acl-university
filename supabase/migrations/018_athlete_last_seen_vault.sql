-- Track the last time each athlete loaded /vault so we can surface a
-- "new" badge in the nav whenever brand_partners.created_at exceeds
-- the athlete's last_seen_vault_at. Default to now() so existing
-- athletes don't see the badge for every historical brand the moment
-- this rolls out.

alter table public.athletes
  add column last_seen_vault_at timestamptz not null default now();
