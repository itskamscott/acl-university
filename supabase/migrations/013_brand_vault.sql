-- ACL Brand Vault (Door 1): brand partner offers + per-athlete reveals,
-- with a monthly reveal cap enforced atomically via an RPC.

-- ============================================================
-- 1. Extend athletes table for Vault profile-completeness gating.
--    Re-views and the reveal RPC require these fields populated.
-- ============================================================
alter table public.athletes
  add column if not exists instagram_handle text,
  add column if not exists shipping_address text;

-- ============================================================
-- 2. brand_partners — admin-managed offers visible to all athletes
-- ============================================================
create table if not exists public.brand_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text not null,
  offer_headline text not null,
  offer_description text,
  discount_code text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_partners enable row level security;

-- Any authenticated athlete can read active offers. Inserts/updates/deletes
-- happen via the Supabase dashboard (service role bypasses RLS).
create policy "Authenticated athletes can view active brand partners"
  on public.brand_partners for select
  to authenticated
  using (is_active = true);

create trigger set_brand_partners_updated_at
  before update on public.brand_partners
  for each row execute function public.handle_updated_at();

create index if not exists idx_brand_partners_active_order
  on public.brand_partners(is_active, display_order);

-- ============================================================
-- 3. reveals — one row per (athlete, brand) the athlete has revealed
-- ============================================================
create table if not exists public.reveals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  brand_partner_id uuid not null references public.brand_partners(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  unique (athlete_id, brand_partner_id)
);

alter table public.reveals enable row level security;

create policy "Athletes can view their own reveals"
  on public.reveals for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own reveals"
  on public.reveals for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create index if not exists idx_reveals_athlete_month
  on public.reveals(athlete_id, revealed_at);

-- ============================================================
-- 4. reveal_brand_code RPC — atomic profile-check + cap-check + insert
--
-- Returns one of three outcomes via the `status` field:
--   'new'      — first reveal of this brand by this athlete; counted against cap
--   'existing' — already revealed; returns the same code, NOT counted again
--   (errors raised for incomplete profile, inactive brand, cap reached)
--
-- Runs as security definer so it can read auth.users.email_confirmed_at and
-- enforce invariants in a single transaction. Always derives athlete_id from
-- auth.uid() so callers cannot impersonate another athlete.
-- ============================================================
create or replace function public.reveal_brand_code(p_brand_partner_id uuid)
returns table (
  status text,
  discount_code text,
  reveal_id uuid,
  reveals_used_this_month integer,
  reveals_cap integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete record;
  v_brand record;
  v_existing_id uuid;
  v_existing_revealed_at timestamptz;
  v_email_verified boolean;
  v_used_this_month integer;
  v_cap constant integer := 3;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc');
begin
  -- 1. Resolve athlete from auth context
  select id, full_name, sport, school, instagram_handle, shipping_address, auth_user_id
    into v_athlete
    from public.athletes
    where auth_user_id = auth.uid();

  if v_athlete.id is null then
    raise exception 'athlete_not_found' using errcode = 'P0001';
  end if;

  -- 2. Brand must exist and be active
  select id, discount_code into v_brand
    from public.brand_partners
    where id = p_brand_partner_id and is_active = true;

  if v_brand.id is null then
    raise exception 'brand_inactive_or_missing' using errcode = 'P0002';
  end if;

  -- 3. Profile completeness — same fields as isProfileCompleteForVault() in TS
  select coalesce(email_confirmed_at is not null, false)
    into v_email_verified
    from auth.users
    where id = v_athlete.auth_user_id;

  if not v_email_verified
     or coalesce(btrim(v_athlete.full_name), '') = ''
     or coalesce(btrim(v_athlete.sport), '') = ''
     or coalesce(btrim(v_athlete.school), '') = ''
     or coalesce(btrim(v_athlete.instagram_handle), '') = ''
     or coalesce(btrim(v_athlete.shipping_address), '') = ''
  then
    raise exception 'profile_incomplete' using errcode = 'P0003';
  end if;

  -- 4. Re-view: already revealed this brand → return existing without counting
  select id, revealed_at into v_existing_id, v_existing_revealed_at
    from public.reveals
    where athlete_id = v_athlete.id
      and brand_partner_id = p_brand_partner_id;

  -- Always count this month's reveals (used for both branches' return value)
  select count(*)::integer into v_used_this_month
    from public.reveals
    where athlete_id = v_athlete.id
      and revealed_at >= v_month_start;

  if v_existing_id is not null then
    return query select
      'existing'::text,
      v_brand.discount_code,
      v_existing_id,
      v_used_this_month,
      v_cap;
    return;
  end if;

  -- 5. Cap check — only blocks new reveals
  if v_used_this_month >= v_cap then
    raise exception 'monthly_cap_reached' using errcode = 'P0004';
  end if;

  -- 6. New reveal
  insert into public.reveals (athlete_id, brand_partner_id)
  values (v_athlete.id, p_brand_partner_id)
  returning id into v_existing_id;

  return query select
    'new'::text,
    v_brand.discount_code,
    v_existing_id,
    (v_used_this_month + 1),
    v_cap;
end;
$$;

grant execute on function public.reveal_brand_code(uuid) to authenticated;
