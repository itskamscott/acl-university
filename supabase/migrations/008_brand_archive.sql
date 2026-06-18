-- Soft-delete for brands. Archived rows stay in the DB (and their
-- activity history stays intact) but drop out of default views.

alter table public.brands
  add column if not exists archived_at timestamptz;

create index if not exists idx_brands_archived_at on public.brands(archived_at);
