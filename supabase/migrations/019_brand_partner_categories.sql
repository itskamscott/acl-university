-- Categories on brand_partners so athletes can filter /vault by type
-- (Apparel / Food / Tech / Fitness / etc.) and admins can curate by
-- mix. Stored as a free-form text with a check constraint to keep
-- the value set tight without locking us into a custom Postgres enum.

alter table public.brand_partners
  add column category text not null default 'other'
  check (category in (
    'apparel',
    'food',
    'tech',
    'fitness',
    'beauty',
    'wellness',
    'finance',
    'other'
  ));

create index idx_brand_partners_category on public.brand_partners(category);
