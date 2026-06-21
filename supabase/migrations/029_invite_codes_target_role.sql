-- ============================================================================
-- 029: Staff signup via target-role invite codes
-- ----------------------------------------------------------------------------
-- Adds invite_codes.target_role so a uni-admin can issue a code that lands
-- a new signup directly into team_manager (or athlete) state — no more
-- post-signup SQL flips to promote a coach.
--
-- Trigger extension: when a code with target_role='team_manager' is claimed,
-- the bind_athlete_to_team_on_invite_claim trigger ALSO:
--   * updates profiles.role to 'team_manager'
--   * sets profiles.org_id from the team's org
--   * inserts a team_assignments row of kind='manager' (instead of 'athlete')
--   * does NOT touch athletes (a coach isn't an athlete)
--
-- university_admin onboarding stays SQL-only for now — they don't bind to a
-- single team, so they need a different shape. Phase 7+.
-- ============================================================================

do $$ begin create type public.invite_target_role as enum
  ('athlete','team_manager');
exception when duplicate_object then null; end $$;

alter table public.invite_codes
  add column target_role public.invite_target_role not null default 'athlete';

-- Rewrite the bind trigger to route based on target_role.
create or replace function public.bind_athlete_to_team_on_invite_claim()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_auth_user_id uuid;
  v_org_id uuid;
begin
  -- Only act on the transition from "unclaimed" → "claimed"
  if (new.used_by is not null and old.used_by is null) then
    -- Resolve the auth.users id (== profiles.id) for the claiming user
    select auth_user_id into v_auth_user_id
      from public.athletes
     where id = new.used_by;

    if (v_auth_user_id is null) then
      return new;
    end if;

    -- Athlete codes (existing behavior): create team_assignment of kind=athlete.
    -- Phase 1's sync_athlete_tenancy trigger then denormalizes onto athletes.
    if (new.target_role = 'athlete' and new.team_id is not null) then
      insert into public.team_assignments (team_id, profile_id, kind)
      values (new.team_id, v_auth_user_id, 'athlete')
      on conflict (team_id, profile_id, kind) do nothing;
    end if;

    -- Staff codes (new): promote profile role + bind as manager. Athletes row
    -- created during signup hangs around but the user becomes a coach in
    -- profile terms and team_assignments.
    if (new.target_role = 'team_manager' and new.team_id is not null) then
      select org_id into v_org_id from public.teams where id = new.team_id;
      update public.profiles
         set role = 'team_manager',
             org_id = v_org_id
       where id = v_auth_user_id;
      insert into public.team_assignments (team_id, profile_id, kind)
      values (new.team_id, v_auth_user_id, 'manager')
      on conflict (team_id, profile_id, kind) do nothing;
    end if;
  end if;

  return new;
end;
$$;
