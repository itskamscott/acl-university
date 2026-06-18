-- ============================================================================
-- 027: Also sync profiles.org_id when an athlete is assigned to a team.
-- ----------------------------------------------------------------------------
-- Migration 022's sync_athlete_tenancy() trigger updated athletes.team_id and
-- athletes.org_id but left profiles.org_id null for new athletes. That broke
-- organizations_select RLS for athletes (auth_org() returned null → the
-- "id = auth_org()" check failed → athletes couldn't read their own org).
--
-- Extend the trigger to also propagate org_id onto profiles.
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
    update public.profiles
       set org_id = v_org_id
     where id = new.profile_id
       and org_id is null;  -- don't overwrite an existing assignment
  end if;
  return new;
end;
$$;
