-- ============================================================================
-- 024: Phase 2 — bind athletes to a team via team-linked invite codes
-- ----------------------------------------------------------------------------
-- Adds optional team_id to invite_codes. When an athlete claims a team-linked
-- invite code (used_by goes from null to non-null), a trigger inserts a
-- team_assignments row of kind='athlete'. The Phase 1 sync_athlete_tenancy
-- trigger then denormalizes athletes.team_id / athletes.org_id automatically.
--
-- Existing invite codes without a team continue working — athletes sign up
-- unassigned and a uni-admin attaches them to a team later (Phase 3).
-- ============================================================================

alter table public.invite_codes
  add column team_id uuid references public.teams(id) on delete set null;
create index idx_invite_codes_team_id on public.invite_codes(team_id);

-- ----------------------------------------------------------------------------
-- Trigger: on invite_codes UPDATE, when used_by becomes non-null AND the
-- invite carries a team_id, create the team_assignments row. Security
-- definer so the insert bypasses RLS (athletes can't self-insert into
-- team_assignments per spec §2).
-- ----------------------------------------------------------------------------
create or replace function public.bind_athlete_to_team_on_invite_claim()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_auth_user_id uuid;
begin
  -- Only act on the transition from "unclaimed" → "claimed"
  if (new.used_by is not null and old.used_by is null and new.team_id is not null) then
    -- Resolve the auth.users id (== profiles.id) for the claiming athlete
    select auth_user_id into v_auth_user_id
      from public.athletes
     where id = new.used_by;

    if (v_auth_user_id is null) then
      -- Should not happen, but don't blow up signup if it does
      return new;
    end if;

    insert into public.team_assignments (team_id, profile_id, kind)
    values (new.team_id, v_auth_user_id, 'athlete')
    on conflict (team_id, profile_id, kind) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bind_athlete_on_invite_claim on public.invite_codes;
create trigger trg_bind_athlete_on_invite_claim
  after update of used_by on public.invite_codes
  for each row execute function public.bind_athlete_to_team_on_invite_claim();
