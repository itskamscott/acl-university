-- Lab Partners Program foundation: a tier on every athlete plus pods.
-- This migration is intentionally minimal. Active-status tracking,
-- attendance, initiatives, and revenue are deferred until the program
-- has run long enough for the rules to stabilize.
--
-- Tier values mirror the program packet: Members are the broader
-- community (default), Insiders are apprentices coached by a Lab
-- Partner, Lab Partners run pods, Founders run the org.
--
-- is_admin and tier='founder' are kept in lockstep here. is_admin
-- continues to drive every existing requireAdmin() check; the tier
-- column adds a richer role surface that future Lab Partner features
-- gate against. Existing admins are backfilled to 'founder' so
-- there's no period where the two disagree.

-- ============================================================
-- 1. Tier on athletes
-- ============================================================
alter table public.athletes
  add column tier text not null default 'member'
  check (tier in ('member', 'insider', 'lab_partner', 'founder'));

update public.athletes set tier = 'founder' where is_admin = true;

create index idx_athletes_tier on public.athletes(tier);

-- ============================================================
-- 2. pods — one row per pod, owned by a single Lab Partner
--
-- The lab_partner_id FK uses ON DELETE RESTRICT because losing a pod's
-- LP without first reassigning members would orphan Insiders. Founders
-- handle reassignment explicitly when an LP reverts to Member.
-- ============================================================
create table public.pods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lab_partner_id uuid not null references public.athletes(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.pods enable row level security;

-- Any authenticated athlete can read non-archived pods (so Insiders can
-- discover their pod, members can see who's leading what, etc.). Writes
-- happen via service-role admin actions only.
create policy "Authenticated athletes can view active pods"
  on public.pods for select
  to authenticated
  using (archived_at is null);

create index idx_pods_lab_partner on public.pods(lab_partner_id);

-- ============================================================
-- 3. pod_memberships — Insider <-> pod, with leave history preserved
--
-- An athlete can only be in ONE active pod at a time, enforced by a
-- partial unique index on (athlete_id) WHERE left_at IS NULL. Old rows
-- with a non-null left_at stay around for review history.
-- ============================================================
create table public.pod_memberships (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid not null references public.pods(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

alter table public.pod_memberships enable row level security;

create unique index idx_pod_memberships_one_active_per_athlete
  on public.pod_memberships(athlete_id)
  where left_at is null;

create index idx_pod_memberships_pod on public.pod_memberships(pod_id, left_at);

-- An athlete can see their own memberships (current + past), and their
-- pod-mate Lab Partner can see the membership rows of athletes inside
-- pods they lead.
create policy "Athletes can view their own pod memberships"
  on public.pod_memberships for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Lab Partners can view memberships of pods they lead"
  on public.pod_memberships for select
  using (
    pod_id in (
      select p.id
      from public.pods p
      join public.athletes a on a.id = p.lab_partner_id
      where a.auth_user_id = auth.uid()
    )
  );
