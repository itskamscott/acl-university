-- ============================================================================
-- 022: University tenancy layer
-- ----------------------------------------------------------------------------
-- Adapts ACL_University_Build_Spec.md to the real schema:
--   * The spec's "deals" maps to existing `contracts`.
--   * The spec's "profiles" did NOT exist; we CREATE it as the auth/role
--     layer keyed to auth.users(id). Existing `athletes` keeps athlete-
--     specific data and links via athletes.auth_user_id = profiles.id.
--   * We denormalize org_id+team_id onto all athlete-owned tables so RLS
--     checks one indexed column instead of joining through athlete→team→org.
-- ============================================================================

-- Enums (idempotent in case of re-run)
do $$ begin create type public.user_role as enum
  ('acl_admin','university_admin','team_manager','athlete');
exception when duplicate_object then null; end $$;

do $$ begin create type public.acl_deal_status as enum
  ('proposed','agreement_attached','acl_review','active','deliverables','paid','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.payout_status as enum
  ('pending','invoiced','received','paid_out');
exception when duplicate_object then null; end $$;

do $$ begin create type public.assignment_kind as enum
  ('athlete','manager');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- New tables
-- ============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_acl_percentage numeric(5,2) not null default 20.00, -- placeholder; set real number per spec §8
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sport text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_teams_org_id on public.teams(org_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'athlete',
  org_id uuid references public.organizations(id),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_org_id on public.profiles(org_id);

create table public.team_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.assignment_kind not null,
  created_at timestamptz not null default now(),
  unique (team_id, profile_id, kind)
);
create index idx_team_assignments_profile_id on public.team_assignments(profile_id);
create index idx_team_assignments_team_id on public.team_assignments(team_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  team_id uuid references public.teams(id),
  gross_amount numeric(12,2) not null,
  acl_fee numeric(12,2) not null,
  athlete_net numeric(12,2) not null,
  status public.payout_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payouts_org_id on public.payouts(org_id);
create index idx_payouts_team_id on public.payouts(team_id);
create index idx_payouts_contract_id on public.payouts(contract_id);

-- ============================================================================
-- Denormalize tenancy onto existing athlete-owned tables
-- (org_id + team_id; nullable for pre-tenancy rows / system data)
-- ============================================================================

alter table public.athletes
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_athletes_org_id on public.athletes(org_id);
create index idx_athletes_team_id on public.athletes(team_id);

alter table public.brands
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_brands_org_id on public.brands(org_id);
create index idx_brands_team_id on public.brands(team_id);

alter table public.brand_activities
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_brand_activities_org_id on public.brand_activities(org_id);
create index idx_brand_activities_team_id on public.brand_activities(team_id);

-- contracts == spec's "deals". Add tenancy + ACL routing fields.
alter table public.contracts
  add column org_id                uuid references public.organizations(id),
  add column team_id               uuid references public.teams(id),
  add column sourced_by            uuid references public.profiles(id),
  add column brand_name            text,
  add column gross_amount          numeric(12,2),
  add column acl_percentage        numeric(5,2),
  add column acl_status            public.acl_deal_status not null default 'proposed',
  add column brand_agreement_url   text,
  add column athlete_agreement_url text;
create index idx_contracts_org_id on public.contracts(org_id);
create index idx_contracts_team_id on public.contracts(team_id);
create index idx_contracts_acl_status on public.contracts(acl_status);

alter table public.deliverables
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_deliverables_org_id on public.deliverables(org_id);
create index idx_deliverables_team_id on public.deliverables(team_id);

alter table public.contract_payments
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_contract_payments_org_id on public.contract_payments(org_id);
create index idx_contract_payments_team_id on public.contract_payments(team_id);

alter table public.content_posts
  add column org_id  uuid references public.organizations(id),
  add column team_id uuid references public.teams(id);
create index idx_content_posts_org_id on public.content_posts(org_id);
create index idx_content_posts_team_id on public.content_posts(team_id);

-- ============================================================================
-- updated_at triggers for new tables
-- ============================================================================
create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();
create trigger set_teams_updated_at
  before update on public.teams
  for each row execute function public.handle_updated_at();
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_payouts_updated_at
  before update on public.payouts
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- RLS helper functions
-- security definer + stable, search_path locked. They bypass RLS internally,
-- so policies can call them without triggering recursion on `profiles`.
-- ============================================================================

create or replace function public.auth_role() returns public.user_role
  language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_org() returns uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_acl_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role = 'acl_admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.managed_team_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select team_id from public.team_assignments
   where profile_id = auth.uid() and kind = 'manager'
$$;

-- Bonus: athletes.id for the current auth.uid() (used by athlete RLS).
create or replace function public.auth_athlete_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.athletes where auth_user_id = auth.uid()
$$;

-- ============================================================================
-- Enable RLS on new tables
-- ============================================================================
alter table public.organizations    enable row level security;
alter table public.teams            enable row level security;
alter table public.profiles         enable row level security;
alter table public.team_assignments enable row level security;
alter table public.payouts          enable row level security;

-- ============================================================================
-- Policies: organizations
-- ============================================================================
create policy organizations_select on public.organizations for select using (
  public.is_acl_admin()
  or id = public.auth_org()
  or id in (select t.org_id from public.teams t where t.id in (select public.managed_team_ids()))
);
create policy organizations_insert on public.organizations for insert
  with check (public.is_acl_admin());
create policy organizations_update on public.organizations for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and id = public.auth_org())
);
create policy organizations_delete on public.organizations for delete using (public.is_acl_admin());

-- ============================================================================
-- Policies: teams
-- ============================================================================
create policy teams_select on public.teams for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or id in (select public.managed_team_ids())
  or id in (select team_id from public.team_assignments
              where profile_id = auth.uid() and kind = 'athlete')
);
create policy teams_insert on public.teams for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);
create policy teams_update on public.teams for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);
create policy teams_delete on public.teams for delete using (public.is_acl_admin());

-- ============================================================================
-- Policies: profiles
-- Self-read always allowed; admins read scoped. No recursion: helpers are
-- security definer and bypass RLS internally.
-- ============================================================================
create policy profiles_select_self on public.profiles for select using (id = auth.uid());
create policy profiles_select_scoped on public.profiles for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager' and id in (
        select profile_id from public.team_assignments
         where team_id in (select public.managed_team_ids())
     ))
);
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() or public.is_acl_admin());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete using (public.is_acl_admin());

-- ============================================================================
-- Policies: team_assignments
-- ============================================================================
create policy team_assignments_select on public.team_assignments for select using (
  public.is_acl_admin()
  or profile_id = auth.uid()
  or (public.auth_role() = 'university_admin'
      and team_id in (select t.id from public.teams t where t.org_id = public.auth_org()))
  or (public.auth_role() = 'team_manager'
      and team_id in (select public.managed_team_ids()))
);
create policy team_assignments_insert on public.team_assignments for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin'
      and team_id in (select t.id from public.teams t where t.org_id = public.auth_org()))
);
create policy team_assignments_update on public.team_assignments for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin'
      and team_id in (select t.id from public.teams t where t.org_id = public.auth_org()))
);
create policy team_assignments_delete on public.team_assignments for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin'
      and team_id in (select t.id from public.teams t where t.org_id = public.auth_org()))
);

-- ============================================================================
-- Rewrite policies on athlete-owned tables: keep athlete access, add scoped
-- staff/admin access. Drop old single-role policies, add multi-role ones.
-- ============================================================================

-- athletes
drop policy if exists "Athletes can view their own profile"   on public.athletes;
drop policy if exists "Athletes can update their own profile" on public.athletes;
drop policy if exists "Athletes can insert their own profile" on public.athletes;

create policy athletes_select on public.athletes for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and auth_user_id = auth.uid())
);
create policy athletes_insert on public.athletes for insert with check (
  (public.auth_role() = 'athlete' and auth_user_id = auth.uid())
  or public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);
create policy athletes_update on public.athletes for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and auth_user_id = auth.uid())
);
create policy athletes_delete on public.athletes for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);

-- brands (CRM)
drop policy if exists "Athletes can view their own brands"   on public.brands;
drop policy if exists "Athletes can insert their own brands" on public.brands;
drop policy if exists "Athletes can update their own brands" on public.brands;
drop policy if exists "Athletes can delete their own brands" on public.brands;

create policy brands_select on public.brands for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy brands_insert on public.brands for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy brands_update on public.brands for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy brands_delete on public.brands for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);

-- brand_activities
drop policy if exists "Athletes can view their own activities"   on public.brand_activities;
drop policy if exists "Athletes can insert their own activities" on public.brand_activities;

create policy brand_activities_select on public.brand_activities for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy brand_activities_insert on public.brand_activities for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);

-- contracts (== spec's "deals")
drop policy if exists "Athletes can view their own contracts"   on public.contracts;
drop policy if exists "Athletes can insert their own contracts" on public.contracts;
drop policy if exists "Athletes can update their own contracts" on public.contracts;
drop policy if exists "Athletes can delete their own contracts" on public.contracts;

create policy contracts_select on public.contracts for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy contracts_insert on public.contracts for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy contracts_update on public.contracts for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy contracts_delete on public.contracts for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);

-- deliverables
drop policy if exists "Athletes can view their own deliverables"   on public.deliverables;
drop policy if exists "Athletes can insert their own deliverables" on public.deliverables;
drop policy if exists "Athletes can update their own deliverables" on public.deliverables;
drop policy if exists "Athletes can delete their own deliverables" on public.deliverables;

create policy deliverables_select on public.deliverables for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy deliverables_insert on public.deliverables for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy deliverables_update on public.deliverables for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy deliverables_delete on public.deliverables for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);

-- contract_payments — tighter writes (only athlete + acl_admin)
drop policy if exists "Athletes can view their own contract payments"   on public.contract_payments;
drop policy if exists "Athletes can insert their own contract payments" on public.contract_payments;
drop policy if exists "Athletes can update their own contract payments" on public.contract_payments;
drop policy if exists "Athletes can delete their own contract payments" on public.contract_payments;

create policy contract_payments_select on public.contract_payments for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy contract_payments_insert on public.contract_payments for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'athlete' and athlete_id = public.auth_athlete_id())
);
create policy contract_payments_update on public.contract_payments for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'athlete' and athlete_id = public.auth_athlete_id())
);
create policy contract_payments_delete on public.contract_payments for delete using (
  public.is_acl_admin()
);

-- content_posts
drop policy if exists "Athletes can view their own content posts"   on public.content_posts;
drop policy if exists "Athletes can insert their own content posts" on public.content_posts;
drop policy if exists "Athletes can update their own content posts" on public.content_posts;
drop policy if exists "Athletes can delete their own content posts" on public.content_posts;

create policy content_posts_select on public.content_posts for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy content_posts_insert on public.content_posts for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy content_posts_update on public.content_posts for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);
create policy content_posts_delete on public.content_posts for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'athlete'         and athlete_id = public.auth_athlete_id())
);

-- payouts — ACL super-admin owns; uni-admin can read their own org's
create policy payouts_select on public.payouts for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
);
create policy payouts_insert on public.payouts for insert with check (public.is_acl_admin());
create policy payouts_update on public.payouts for update using (public.is_acl_admin());
create policy payouts_delete on public.payouts for delete using (public.is_acl_admin());

-- ============================================================================
-- Auto-create profile on auth.users insert. New signups get role='athlete'.
-- Promotion to staff roles happens via uni-admin or acl-admin.
-- ============================================================================
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, role) values (new.id, 'athlete')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- Sync denormalized tenancy on athletes when team assignments change
-- ============================================================================
create or replace function public.sync_athlete_tenancy()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org_id uuid;
begin
  if (new.kind = 'athlete') then
    select org_id into v_org_id from public.teams where id = new.team_id;
    update public.athletes
       set team_id = new.team_id,
           org_id  = v_org_id
     where auth_user_id = new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_athlete_tenancy on public.team_assignments;
create trigger trg_sync_athlete_tenancy
  after insert on public.team_assignments
  for each row execute function public.sync_athlete_tenancy();
