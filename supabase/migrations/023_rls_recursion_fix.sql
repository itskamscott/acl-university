-- ============================================================================
-- 023: Fix RLS recursion by routing cross-table lookups through
-- security-definer helpers (which bypass RLS internally).
--
-- The recursion in 022 came from policies on `teams`, `team_assignments`,
-- `organizations`, and `profiles_select_scoped` containing inline subqueries
-- against the same set of tables — each subquery re-entered RLS and looped.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Additional helpers (all stable + security definer)
-- ----------------------------------------------------------------------------

-- Teams the caller is enrolled in as an athlete
create or replace function public.athlete_team_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select team_id from public.team_assignments
   where profile_id = auth.uid() and kind = 'athlete'
$$;

-- Teams in the caller's org (uni-admin scope)
create or replace function public.org_team_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select t.id from public.teams t
    join public.profiles p on p.org_id = t.org_id
   where p.id = auth.uid()
$$;

-- Profile-ids assigned to teams the caller manages
create or replace function public.managed_profile_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select ta.profile_id from public.team_assignments ta
   where ta.team_id in (
     select team_id from public.team_assignments
      where profile_id = auth.uid() and kind = 'manager'
   )
$$;

-- Org-ids the caller manages teams in
create or replace function public.managed_org_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
  select distinct t.org_id from public.teams t
    join public.team_assignments ta on ta.team_id = t.id
   where ta.profile_id = auth.uid() and ta.kind = 'manager'
$$;

-- ----------------------------------------------------------------------------
-- Rewrite organizations_select to drop the inline `teams` subquery
-- ----------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select using (
  public.is_acl_admin()
  or id = public.auth_org()
  or id in (select public.managed_org_ids())
);

-- ----------------------------------------------------------------------------
-- Rewrite teams_select to drop the inline `team_assignments` subquery
-- ----------------------------------------------------------------------------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or id in (select public.managed_team_ids())
  or id in (select public.athlete_team_ids())
);

-- ----------------------------------------------------------------------------
-- Rewrite team_assignments_select to drop the inline `teams` subquery
-- ----------------------------------------------------------------------------
drop policy if exists team_assignments_select on public.team_assignments;
create policy team_assignments_select on public.team_assignments for select using (
  public.is_acl_admin()
  or profile_id = auth.uid()
  or (public.auth_role() = 'university_admin' and team_id in (select public.org_team_ids()))
  or (public.auth_role() = 'team_manager'    and team_id in (select public.managed_team_ids()))
);

-- Same fix for team_assignments write policies (they had the same `teams` subquery)
drop policy if exists team_assignments_insert on public.team_assignments;
create policy team_assignments_insert on public.team_assignments for insert with check (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and team_id in (select public.org_team_ids()))
);

drop policy if exists team_assignments_update on public.team_assignments;
create policy team_assignments_update on public.team_assignments for update using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and team_id in (select public.org_team_ids()))
);

drop policy if exists team_assignments_delete on public.team_assignments;
create policy team_assignments_delete on public.team_assignments for delete using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and team_id in (select public.org_team_ids()))
);

-- ----------------------------------------------------------------------------
-- Rewrite profiles_select_scoped (team_manager clause referenced team_assignments)
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles for select using (
  public.is_acl_admin()
  or (public.auth_role() = 'university_admin' and org_id = public.auth_org())
  or (public.auth_role() = 'team_manager'    and id in (select public.managed_profile_ids()))
);
