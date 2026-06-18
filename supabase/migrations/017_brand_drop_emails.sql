-- Brand Vault email-on-launch. When an admin curates a new brand
-- partner, they can fire a one-shot email blast to athletes opted in
-- to brand-drop notifications. The brand_drop_emails table tracks
-- exactly which athletes received the drop for which brand so the
-- admin UI can show coverage and so we never double-send the same
-- (brand, athlete) pair.

alter table public.athletes
  add column email_brand_drops boolean not null default true;

create table public.brand_drop_emails (
  id uuid primary key default gen_random_uuid(),
  brand_partner_id uuid not null references public.brand_partners(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (brand_partner_id, athlete_id)
);

alter table public.brand_drop_emails enable row level security;

-- No client-side reads needed; admin UI uses the service-role client.
-- An empty policy set means every non-service-role read returns zero
-- rows, which is what we want.

create index idx_brand_drop_emails_brand on public.brand_drop_emails(brand_partner_id);
