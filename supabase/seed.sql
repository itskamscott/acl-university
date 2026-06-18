-- Seed data for local supabase db reset. Not applied to remote.
-- Add invite codes here for local development.

insert into public.invite_codes (code) values
  ('ACL-TEAM-0001'),
  ('ACL-TEAM-0002'),
  ('ACL-TEAM-0003'),
  ('ACL-TEAM-0004'),
  ('ACL-TEAM-0005')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- Brand Vault example offers (Door 1)
-- Real offers are added in the Supabase dashboard — see BRAND_VAULT.md.
-- ------------------------------------------------------------
insert into public.brand_partners
  (name, logo_url, website_url, offer_headline, offer_description, discount_code, display_order)
values
  (
    'Gymshark',
    null,
    'https://gymshark.com',
    '15% off your first order',
    'New customers only. Stacks with the gameday drop. Excludes accessories.',
    'ACL15-GS',
    10
  ),
  (
    'Manscaped',
    null,
    'https://manscaped.com',
    '20% off + free shipping',
    'Sitewide on the Lawn Mower 5.0 and trim packs. US shipping only.',
    'ACL20',
    20
  ),
  (
    'Ladder',
    null,
    'https://ladder.sport',
    'Free 7-day pass + 25% off plans',
    'Strength, mobility, and sport-specific programs. Cancel any time.',
    'ACL-LADDER',
    30
  )
on conflict do nothing;
